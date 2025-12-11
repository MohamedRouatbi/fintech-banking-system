export enum LedgerAccountType {
  ASSET = 'ASSET',           // Debits increase, Credits decrease
  LIABILITY = 'LIABILITY',   // Credits increase, Debits decrease
  EQUITY = 'EQUITY',         // Credits increase, Debits decrease
  REVENUE = 'REVENUE',       // Credits increase, Debits decrease
  EXPENSE = 'EXPENSE',       // Debits increase, Credits decrease
}

export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export interface LedgerAccount {
  id: string;
  name: string;
  type: LedgerAccountType;
  currency: string;
  balance: number;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  balance: number; // Balance after this entry
  description: string;
  metadata?: any;
  createdAt: Date;
}

export interface LedgerTransaction {
  id: string;
  idempotencyKey: string;
  reference: string;
  description: string;
  totalAmount: number;
  currency: string;
  entries: LedgerEntry[];
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  createdAt: Date;
  completedAt?: Date;
}
