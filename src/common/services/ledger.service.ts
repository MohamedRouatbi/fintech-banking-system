import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  LedgerEntry,
  LedgerAccount,
  LedgerEntryType,
  LedgerAccountType,
} from '../interfaces/ledger.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Double-Entry Ledger Service
 * Implements double-entry bookkeeping for financial transactions
 * Every transaction must have equal debits and credits
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private ledgerEntries: LedgerEntry[] = [];
  private ledgerAccounts: Map<string, LedgerAccount> = new Map();

  /**
   * Create or get a ledger account
   */
  async getOrCreateAccount(
    name: string,
    type: LedgerAccountType,
    currency: string,
    userId?: number,
    walletId?: number,
  ): Promise<LedgerAccount> {
    const accountId = `${type}_${currency}_${userId || 'system'}_${walletId || 'none'}`;
    
    if (this.ledgerAccounts.has(accountId)) {
      return this.ledgerAccounts.get(accountId)!;
    }

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

    this.ledgerAccounts.set(accountId, account);
    this.logger.log(`Created ledger account: ${accountId}`);
    
    return account;
  }

  /**
   * Record a double-entry transaction
   * Debits must equal credits
   */
  async recordTransaction(
    transactionId: string,
    entries: Array<{
      accountId: string;
      accountType: LedgerAccountType;
      entryType: LedgerEntryType;
      amount: number;
      currency: string;
      description: string;
      metadata?: any;
    }>,
  ): Promise<LedgerEntry[]> {
    // Validate double-entry bookkeeping
    const debitTotal = entries
      .filter((e) => e.entryType === LedgerEntryType.DEBIT)
      .reduce((sum, e) => sum + e.amount, 0);

    const creditTotal = entries
      .filter((e) => e.entryType === LedgerEntryType.CREDIT)
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      throw new BadRequestException(
        `Double-entry validation failed: Debits (${debitTotal}) must equal Credits (${creditTotal})`,
      );
    }

    const recordedEntries: LedgerEntry[] = [];

    // Record each entry and update account balances
    for (const entry of entries) {
      const account = this.ledgerAccounts.get(entry.accountId);
      
      if (!account) {
        throw new BadRequestException(`Account ${entry.accountId} not found`);
      }

      if (account.currency !== entry.currency) {
        throw new BadRequestException(
          `Currency mismatch: Account is ${account.currency}, entry is ${entry.currency}`,
        );
      }

      // Calculate new balance based on account type and entry type
      const balanceChange = this.calculateBalanceChange(
        account.type,
        entry.entryType,
        entry.amount,
      );

      const newBalance = account.balance + balanceChange;

      // Create ledger entry
      const ledgerEntry: LedgerEntry = {
        id: uuidv4(),
        transactionId,
        accountId: entry.accountId,
        type: entry.entryType,
        amount: entry.amount,
        currency: entry.currency,
        balance: newBalance,
        description: entry.description,
        metadata: entry.metadata,
        createdAt: new Date(),
      };

      this.ledgerEntries.push(ledgerEntry);
      
      // Update account balance
      account.balance = newBalance;
      account.updatedAt = new Date();

      recordedEntries.push(ledgerEntry);

      this.logger.log(
        `Ledger entry: ${entry.entryType} ${entry.amount} ${entry.currency} ` +
        `to ${entry.accountId}, new balance: ${newBalance}`,
      );
    }

    return recordedEntries;
  }

  /**
   * Calculate balance change based on account type and entry type
   * 
   * Normal balances:
   * - Assets: Debit increases, Credit decreases
   * - Liabilities: Credit increases, Debit decreases
   * - Equity: Credit increases, Debit decreases
   * - Revenue: Credit increases, Debit decreases
   * - Expenses: Debit increases, Credit decreases
   */
  private calculateBalanceChange(
    accountType: LedgerAccountType,
    entryType: LedgerEntryType,
    amount: number,
  ): number {
    const isDebit = entryType === LedgerEntryType.DEBIT;

    switch (accountType) {
      case LedgerAccountType.ASSET:
      case LedgerAccountType.EXPENSE:
        return isDebit ? amount : -amount;
      
      case LedgerAccountType.LIABILITY:
      case LedgerAccountType.EQUITY:
      case LedgerAccountType.REVENUE:
        return isDebit ? -amount : amount;
      
      default:
        throw new BadRequestException(`Unknown account type: ${accountType}`);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const account = this.ledgerAccounts.get(accountId);
    
    if (!account) {
      throw new BadRequestException(`Account ${accountId} not found`);
    }

    return account.balance;
  }

  /**
   * Get ledger entries for a transaction
   */
  async getTransactionEntries(transactionId: string): Promise<LedgerEntry[]> {
    return this.ledgerEntries.filter((e) => e.transactionId === transactionId);
  }

  /**
   * Get ledger entries for an account
   */
  async getAccountEntries(
    accountId: string,
    limit = 100,
  ): Promise<LedgerEntry[]> {
    return this.ledgerEntries
      .filter((e) => e.accountId === accountId)
      .slice(-limit);
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<LedgerAccount | undefined> {
    return this.ledgerAccounts.get(accountId);
  }

  /**
   * List all accounts
   */
  async listAccounts(): Promise<LedgerAccount[]> {
    return Array.from(this.ledgerAccounts.values());
  }

  /**
   * Verify ledger integrity
   */
  async verifyLedgerIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Group entries by transaction
    const transactionEntries = new Map<string, LedgerEntry[]>();
    
    for (const entry of this.ledgerEntries) {
      if (!transactionEntries.has(entry.transactionId)) {
        transactionEntries.set(entry.transactionId, []);
      }
      transactionEntries.get(entry.transactionId)!.push(entry);
    }

    // Verify each transaction balances
    for (const [txId, entries] of transactionEntries) {
      const debitTotal = entries
        .filter((e) => e.type === LedgerEntryType.DEBIT)
        .reduce((sum, e) => sum + e.amount, 0);

      const creditTotal = entries
        .filter((e) => e.type === LedgerEntryType.CREDIT)
        .reduce((sum, e) => sum + e.amount, 0);

      if (Math.abs(debitTotal - creditTotal) > 0.01) {
        errors.push(
          `Transaction ${txId}: Debits (${debitTotal}) != Credits (${creditTotal})`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
