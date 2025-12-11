export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  TRADE = 'TRADE',
  FEE = 'FEE',
  REFUND = 'REFUND',
}

export enum AssetType {
  FIAT = 'FIAT',
  CRYPTO = 'CRYPTO',
}

export interface Transaction {
  id: string;
  idempotencyKey: string;
  userId: number;
  type: TransactionType;
  assetType: AssetType;
  amount: number;
  currency: string;
  fee?: number;
  status: TransactionStatus;
  fromWalletId?: number;
  toWalletId?: number;
  fromAddress?: string;
  toAddress?: string;
  externalReference?: string;
  description?: string;
  metadata?: any;
  ledgerTransactionId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

export interface TransactionLock {
  transactionId: string;
  walletId: number;
  amount: number;
  lockedAt: Date;
  expiresAt: Date;
}
