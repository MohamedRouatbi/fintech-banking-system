import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerEntryType, LedgerAccountType } from '../../common/interfaces/ledger.interface';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  AssetType,
  TransactionLock,
} from '../../common/interfaces/transaction.interface';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private transactions: Map<string, Transaction> = new Map();
  private idempotencyKeys: Map<string, string> = new Map(); // key -> transactionId
  private locks: Map<string, TransactionLock> = new Map();

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly walletsService: WalletsService,
    @InjectQueue('transactions') private transactionQueue: Queue,
  ) {}

  /**
   * Create a new transaction with idempotency support
   */
  async create(createTransactionDto: CreateTransactionDto, userId: number): Promise<Transaction> {
    const { idempotencyKey, type, assetType, amount, currency, fromWalletId, toWalletId } =
      createTransactionDto;

    // Check idempotency
    const existingTxId = this.idempotencyKeys.get(idempotencyKey);
    if (existingTxId) {
      const existingTx = this.transactions.get(existingTxId);
      if (existingTx) {
        this.logger.warn(`Duplicate transaction request: ${idempotencyKey}`);
        return existingTx;
      }
    }

    // Validate transaction
    await this.validateTransaction(createTransactionDto, userId);

    // Create transaction record
    const transactionId = uuidv4();
    const transaction: Transaction = {
      id: transactionId,
      idempotencyKey,
      userId,
      type,
      assetType,
      amount,
      currency,
      fee: createTransactionDto.fee || 0,
      status: TransactionStatus.PENDING,
      fromWalletId,
      toWalletId,
      fromAddress: createTransactionDto.fromAddress,
      toAddress: createTransactionDto.toAddress,
      externalReference: createTransactionDto.externalReference,
      description: createTransactionDto.description,
      metadata: createTransactionDto.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.set(transactionId, transaction);
    this.idempotencyKeys.set(idempotencyKey, transactionId);

    this.logger.log(`Created transaction: ${transactionId} (${type})`);

    // Queue for async processing
    await this.transactionQueue.add('process-transaction', {
      transactionId,
    });

    return transaction;
  }

  /**
   * Validate transaction before creation
   */
  private async validateTransaction(
    dto: CreateTransactionDto,
    userId: number,
  ): Promise<void> {
    // Validate amount
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Validate wallets exist and belong to user
    if (dto.fromWalletId) {
      const fromWallet = await this.walletsService.findOne(dto.fromWalletId);
      if (fromWallet.userId !== userId) {
        throw new BadRequestException('Source wallet does not belong to user');
      }

      // Check sufficient balance (including fee)
      const totalRequired = dto.amount + (dto.fee || 0);
      if (fromWallet.balance < totalRequired) {
        throw new ConflictException(
          `Insufficient balance. Required: ${totalRequired}, Available: ${fromWallet.balance}`,
        );
      }
    }

    if (dto.toWalletId) {
      const toWallet = await this.walletsService.findOne(dto.toWalletId);
      // For transfers, ensure different wallets
      if (dto.fromWalletId && dto.fromWalletId === dto.toWalletId) {
        throw new BadRequestException('Cannot transfer to the same wallet');
      }
    }

    // Validate transaction type specific rules
    switch (dto.type) {
      case TransactionType.TRANSFER:
        if (!dto.fromWalletId || !dto.toWalletId) {
          throw new BadRequestException(
            'Transfer requires both source and destination wallets',
          );
        }
        break;
      case TransactionType.DEPOSIT:
        if (!dto.toWalletId) {
          throw new BadRequestException('Deposit requires destination wallet');
        }
        break;
      case TransactionType.WITHDRAWAL:
        if (!dto.fromWalletId) {
          throw new BadRequestException('Withdrawal requires source wallet');
        }
        break;
    }
  }

  /**
   * Process transaction (called by queue worker)
   */
  async processTransaction(transactionId: string): Promise<Transaction> {
    const transaction = await this.findOne(transactionId);

    if (transaction.status !== TransactionStatus.PENDING) {
      this.logger.warn(`Transaction ${transactionId} already processed`);
      return transaction;
    }

    try {
      // Update status to processing
      transaction.status = TransactionStatus.PROCESSING;
      transaction.updatedAt = new Date();

      // Acquire locks on wallets to prevent double-spending
      await this.acquireLocks(transaction);

      // Process based on transaction type
      switch (transaction.type) {
        case TransactionType.DEPOSIT:
          await this.processDeposit(transaction);
          break;
        case TransactionType.WITHDRAWAL:
          await this.processWithdrawal(transaction);
          break;
        case TransactionType.TRANSFER:
          await this.processTransfer(transaction);
          break;
        case TransactionType.TRADE:
          await this.processTrade(transaction);
          break;
        default:
          throw new Error(`Unsupported transaction type: ${transaction.type}`);
      }

      // Mark as completed
      transaction.status = TransactionStatus.COMPLETED;
      transaction.completedAt = new Date();
      transaction.updatedAt = new Date();

      this.logger.log(`Transaction ${transactionId} completed successfully`);
    } catch (error) {
      transaction.status = TransactionStatus.FAILED;
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date();

      this.logger.error(`Transaction ${transactionId} failed: ${error.message}`);
    } finally {
      // Always release locks
      await this.releaseLocks(transaction);
    }

    return transaction;
  }

  /**
   * Process deposit transaction
   */
  private async processDeposit(transaction: Transaction): Promise<void> {
    const { toWalletId, amount, currency, fee, id } = transaction;

    // Update wallet balance
    await this.walletsService.updateBalance(toWalletId!, amount);

    // Create ledger entries (double-entry bookkeeping)
    // Debit: Bank/External Account (Asset increases)
    // Credit: User Wallet (Liability increases - we owe user)
    await this.ledgerService.createTransaction(
      transaction.idempotencyKey,
      `TXN-${id}`,
      `Deposit: ${amount} ${currency}`,
      [
        {
          accountId: `wallet-${toWalletId}`,
          type: LedgerEntryType.CREDIT,
          amount,
        },
        {
          accountId: 'bank-clearing',
          type: LedgerEntryType.DEBIT,
          amount,
        },
      ],
    );

    // Handle fee if applicable
    if (fee && fee > 0) {
      await this.ledgerService.createTransaction(
        `${transaction.idempotencyKey}-fee`,
        `FEE-${id}`,
        `Deposit fee: ${fee} ${currency}`,
        [
          {
            accountId: `wallet-${toWalletId}`,
            type: LedgerEntryType.DEBIT,
            amount: fee,
          },
          {
            accountId: 'fee-revenue',
            type: LedgerEntryType.CREDIT,
            amount: fee,
          },
        ],
      );
    }
  }

  /**
   * Process withdrawal transaction
   */
  private async processWithdrawal(transaction: Transaction): Promise<void> {
    const { fromWalletId, amount, currency, fee, id } = transaction;

    const totalAmount = amount + (fee || 0);

    // Update wallet balance (deduct amount + fee)
    await this.walletsService.updateBalance(fromWalletId!, -totalAmount);

    // Create ledger entries
    // Debit: User Wallet (Liability decreases)
    // Credit: Bank/External Account (Asset decreases)
    await this.ledgerService.createTransaction(
      transaction.idempotencyKey,
      `TXN-${id}`,
      `Withdrawal: ${amount} ${currency}`,
      [
        {
          accountId: `wallet-${fromWalletId}`,
          type: LedgerEntryType.DEBIT,
          amount,
        },
        {
          accountId: 'bank-clearing',
          type: LedgerEntryType.CREDIT,
          amount,
        },
      ],
    );

    // Handle fee
    if (fee && fee > 0) {
      await this.ledgerService.createTransaction(
        `${transaction.idempotencyKey}-fee`,
        `FEE-${id}`,
        `Withdrawal fee: ${fee} ${currency}`,
        [
          {
            accountId: `wallet-${fromWalletId}`,
            type: LedgerEntryType.DEBIT,
            amount: fee,
          },
          {
            accountId: 'fee-revenue',
            type: LedgerEntryType.CREDIT,
            amount: fee,
          },
        ],
      );
    }
  }

  /**
   * Process transfer transaction
   */
  private async processTransfer(transaction: Transaction): Promise<void> {
    const { fromWalletId, toWalletId, amount, currency, fee, id } = transaction;

    const totalAmount = amount + (fee || 0);

    // Update wallet balances
    await this.walletsService.updateBalance(fromWalletId!, -totalAmount);
    await this.walletsService.updateBalance(toWalletId!, amount);

    // Create ledger entries
    await this.ledgerService.createTransaction(
      transaction.idempotencyKey,
      `TXN-${id}`,
      `Transfer: ${amount} ${currency}`,
      [
        {
          accountId: `wallet-${fromWalletId}`,
          type: LedgerEntryType.DEBIT,
          amount,
        },
        {
          accountId: `wallet-${toWalletId}`,
          type: LedgerEntryType.CREDIT,
          amount,
        },
      ],
    );

    // Handle fee
    if (fee && fee > 0) {
      await this.ledgerService.createTransaction(
        `${transaction.idempotencyKey}-fee`,
        `FEE-${id}`,
        `Transfer fee: ${fee} ${currency}`,
        [
          {
            accountId: `wallet-${fromWalletId}`,
            type: LedgerEntryType.DEBIT,
            amount: fee,
          },
          {
            accountId: 'fee-revenue',
            type: LedgerEntryType.CREDIT,
            amount: fee,
          },
        ],
      );
    }
  }

  /**
   * Process trade transaction
   */
  private async processTrade(transaction: Transaction): Promise<void> {
    // TODO: Implement trade logic with broker integration
    this.logger.log(`Processing trade transaction: ${transaction.id}`);
  }

  /**
   * Acquire locks on wallets to prevent double-spending
   */
  private async acquireLocks(transaction: Transaction): Promise<void> {
    const lockDuration = 60000; // 60 seconds
    const expiresAt = new Date(Date.now() + lockDuration);

    if (transaction.fromWalletId) {
      const lockKey = `wallet-${transaction.fromWalletId}`;
      if (this.locks.has(lockKey)) {
        throw new ConflictException(`Wallet ${transaction.fromWalletId} is locked`);
      }
      this.locks.set(lockKey, {
        transactionId: transaction.id,
        walletId: transaction.fromWalletId,
        amount: transaction.amount,
        lockedAt: new Date(),
        expiresAt,
      });
    }

    if (transaction.toWalletId && transaction.toWalletId !== transaction.fromWalletId) {
      const lockKey = `wallet-${transaction.toWalletId}`;
      if (this.locks.has(lockKey)) {
        // Release fromWallet lock if we acquired it
        if (transaction.fromWalletId) {
          this.locks.delete(`wallet-${transaction.fromWalletId}`);
        }
        throw new ConflictException(`Wallet ${transaction.toWalletId} is locked`);
      }
      this.locks.set(lockKey, {
        transactionId: transaction.id,
        walletId: transaction.toWalletId,
        amount: transaction.amount,
        lockedAt: new Date(),
        expiresAt,
      });
    }
  }

  /**
   * Release locks on wallets
   */
  private async releaseLocks(transaction: Transaction): Promise<void> {
    if (transaction.fromWalletId) {
      this.locks.delete(`wallet-${transaction.fromWalletId}`);
    }
    if (transaction.toWalletId) {
      this.locks.delete(`wallet-${transaction.toWalletId}`);
    }
  }

  /**
   * Find all transactions
   */
  async findAll(userId?: number): Promise<Transaction[]> {
    const allTransactions = Array.from(this.transactions.values());
    if (userId) {
      return allTransactions.filter((tx) => tx.userId === userId);
    }
    return allTransactions;
  }

  /**
   * Find transaction by ID
   */
  async findOne(id: string): Promise<Transaction> {
    const transaction = this.transactions.get(id);
    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    return transaction;
  }

  /**
   * Find transaction by idempotency key
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<Transaction | null> {
    const transactionId = this.idempotencyKeys.get(idempotencyKey);
    if (!transactionId) {
      return null;
    }
    return this.findOne(transactionId);
  }

  /**
   * Cancel a pending transaction
   */
  async cancel(id: string, userId: number): Promise<Transaction> {
    const transaction = await this.findOne(id);

    // Verify ownership
    if (transaction.userId !== userId) {
      throw new BadRequestException('Cannot cancel transaction of another user');
    }

    // Only pending transactions can be cancelled
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new ConflictException(
        `Cannot cancel transaction in ${transaction.status} status`,
      );
    }

    transaction.status = TransactionStatus.CANCELLED;
    transaction.cancelledAt = new Date();
    transaction.updatedAt = new Date();

    // Release any locks
    await this.releaseLocks(transaction);

    this.logger.log(`Transaction ${id} cancelled by user ${userId}`);
    return transaction;
  }

  /**
   * Get transaction status
   */
  async getStatus(id: string): Promise<{ id: string; status: TransactionStatus; updatedAt: Date }> {
    const transaction = await this.findOne(id);
    return {
      id: transaction.id,
      status: transaction.status,
      updatedAt: transaction.updatedAt,
    };
  }

  /**
   * Find transactions by wallet
   */
  async findByWallet(walletId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (tx) => tx.fromWalletId === walletId || tx.toWalletId === walletId,
    );
  }
}
