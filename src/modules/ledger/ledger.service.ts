import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  LedgerAccountType,
  LedgerEntryType,
} from '../../common/interfaces/ledger.interface';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private accounts: Map<string, LedgerAccount> = new Map();
  private entries: LedgerEntry[] = [];
  private transactions: Map<string, LedgerTransaction> = new Map();
  private idempotencyKeys: Map<string, string> = new Map(); // key -> transactionId
  private locks: Map<string, boolean> = new Map(); // accountId -> isLocked

  /**
   * Create a new ledger account
   */
  async createAccount(
    name: string,
    type: LedgerAccountType,
    currency: string,
  ): Promise<LedgerAccount> {
    const accountId = uuidv4();
    const account: LedgerAccount = {
      id: accountId,
      name,
      type,
      currency,
      balance: 0,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.accounts.set(accountId, account);
    this.logger.log(`Created ledger account: ${accountId} (${name})`);
    return account;
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<LedgerAccount> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    return account;
  }

  /**
   * Get all accounts
   */
  async getAllAccounts(): Promise<LedgerAccount[]> {
    return Array.from(this.accounts.values());
  }

  /**
   * Lock an account to prevent concurrent modifications
   */
  private async lockAccount(accountId: string): Promise<void> {
    if (this.locks.get(accountId)) {
      throw new ConflictException(`Account ${accountId} is locked`);
    }
    this.locks.set(accountId, true);
  }

  /**
   * Unlock an account
   */
  private async unlockAccount(accountId: string): Promise<void> {
    this.locks.delete(accountId);
  }

  /**
   * Create a double-entry transaction
   * Ensures debits equal credits (accounting equation)
   */
  async createTransaction(
    idempotencyKey: string,
    reference: string,
    description: string,
    entries: Array<{
      accountId: string;
      type: LedgerEntryType;
      amount: number;
    }>,
  ): Promise<LedgerTransaction> {
    // Check idempotency
    const existingTxId = this.idempotencyKeys.get(idempotencyKey);
    if (existingTxId) {
      const existingTx = this.transactions.get(existingTxId);
      if (existingTx) {
        this.logger.warn(`Duplicate transaction attempt: ${idempotencyKey}`);
        return existingTx;
      }
    }

    const transactionId = uuidv4();
    const affectedAccounts = [...new Set(entries.map((e) => e.accountId))];

    try {
      // Lock all affected accounts
      for (const accountId of affectedAccounts) {
        await this.lockAccount(accountId);
      }

      // Validate double-entry bookkeeping
      const totalDebits = entries
        .filter((e) => e.type === LedgerEntryType.DEBIT)
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entries
        .filter((e) => e.type === LedgerEntryType.CREDIT)
        .reduce((sum, e) => sum + e.amount, 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          `Debits (${totalDebits}) must equal Credits (${totalCredits})`,
        );
      }

      // Validate all accounts exist
      for (const entry of entries) {
        const account = await this.getAccount(entry.accountId);
        if (!account) {
          throw new NotFoundException(`Account ${entry.accountId} not found`);
        }
      }

      // Create ledger entries
      const ledgerEntries: LedgerEntry[] = [];
      for (const entry of entries) {
        const account = this.accounts.get(entry.accountId)!;

        // Update balance based on account type and entry type
        let newBalance = account.balance;
        if (this.shouldIncreaseBalance(account.type, entry.type)) {
          newBalance += entry.amount;
        } else {
          newBalance -= entry.amount;
        }

        // Check for negative balance in asset accounts (preventing double-spend)
        if (
          account.type === LedgerAccountType.ASSET &&
          newBalance < 0
        ) {
          throw new ConflictException(
            `Insufficient balance in account ${account.name}. Current: ${account.balance}, Required: ${entry.amount}`,
          );
        }

        // Create entry
        const ledgerEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId,
          accountId: entry.accountId,
          type: entry.type,
          amount: entry.amount,
          currency: account.currency,
          balance: newBalance,
          description,
          createdAt: new Date(),
        };

        ledgerEntries.push(ledgerEntry);
        this.entries.push(ledgerEntry);

        // Update account balance
        account.balance = newBalance;
        account.updatedAt = new Date();
      }

      // Create transaction record
      const transaction: LedgerTransaction = {
        id: transactionId,
        idempotencyKey,
        reference,
        description,
        totalAmount: totalDebits,
        currency: this.accounts.get(entries[0].accountId)!.currency,
        entries: ledgerEntries,
        status: 'COMPLETED',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      this.transactions.set(transactionId, transaction);
      this.idempotencyKeys.set(idempotencyKey, transactionId);

      this.logger.log(
        `Created ledger transaction: ${transactionId} (${reference})`,
      );
      return transaction;
    } finally {
      // Always unlock accounts
      for (const accountId of affectedAccounts) {
        await this.unlockAccount(accountId);
      }
    }
  }

  /**
   * Determine if balance should increase based on account type and entry type
   */
  private shouldIncreaseBalance(
    accountType: LedgerAccountType,
    entryType: LedgerEntryType,
  ): boolean {
    // Asset & Expense: Debits increase, Credits decrease
    if (
      accountType === LedgerAccountType.ASSET ||
      accountType === LedgerAccountType.EXPENSE
    ) {
      return entryType === LedgerEntryType.DEBIT;
    }
    // Liability, Equity & Revenue: Credits increase, Debits decrease
    return entryType === LedgerEntryType.CREDIT;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<LedgerTransaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }
    return transaction;
  }

  /**
   * Get transaction by idempotency key
   */
  async getTransactionByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<LedgerTransaction | null> {
    const transactionId = this.idempotencyKeys.get(idempotencyKey);
    if (!transactionId) {
      return null;
    }
    return this.getTransaction(transactionId);
  }

  /**
   * Get entries for an account
   */
  async getAccountEntries(accountId: string): Promise<LedgerEntry[]> {
    return this.entries.filter((entry) => entry.accountId === accountId);
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const account = await this.getAccount(accountId);
    return account.balance;
  }

  /**
   * Get all transactions
   */
  async getAllTransactions(): Promise<LedgerTransaction[]> {
    return Array.from(this.transactions.values());
  }

  /**
   * Reverse a transaction (create offsetting entries)
   */
  async reverseTransaction(
    originalTransactionId: string,
    reason: string,
  ): Promise<LedgerTransaction> {
    const originalTx = await this.getTransaction(originalTransactionId);

    if (originalTx.status === 'REVERSED') {
      throw new ConflictException('Transaction already reversed');
    }

    // Create offsetting entries (flip debits and credits)
    const reversalEntries = originalTx.entries.map((entry) => ({
      accountId: entry.accountId,
      type:
        entry.type === LedgerEntryType.DEBIT
          ? LedgerEntryType.CREDIT
          : LedgerEntryType.DEBIT,
      amount: entry.amount,
    }));

    const reversalTx = await this.createTransaction(
      `reversal-${originalTransactionId}-${Date.now()}`,
      `REV-${originalTx.reference}`,
      `Reversal: ${reason}`,
      reversalEntries,
    );

    // Mark original transaction as reversed
    originalTx.status = 'REVERSED';

    this.logger.log(`Reversed transaction: ${originalTransactionId}`);
    return reversalTx;
  }
}
