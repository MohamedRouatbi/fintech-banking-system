import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  TRADE = 'TRADE',
}

// This is a mock service - replace with actual database integration
@Injectable()
export class TransactionsService {
  private transactions: any[] = [];
  private idCounter = 1;

  async create(createTransactionDto: CreateTransactionDto) {
    const newTransaction = {
      id: this.idCounter++,
      ...createTransactionDto,
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.push(newTransaction);
    return newTransaction;
  }

  async findAll(userId?: number) {
    if (userId) {
      return this.transactions.filter((tx) => tx.userId === userId);
    }
    return this.transactions;
  }

  async findOne(id: number) {
    const transaction = this.transactions.find((tx) => tx.id === id);
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async updateStatus(id: number, status: TransactionStatus) {
    const transactionIndex = this.transactions.findIndex((tx) => tx.id === id);
    
    if (transactionIndex === -1) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    this.transactions[transactionIndex] = {
      ...this.transactions[transactionIndex],
      status,
      updatedAt: new Date(),
    };

    return this.transactions[transactionIndex];
  }

  async findByWallet(walletId: number) {
    return this.transactions.filter(
      (tx) => tx.fromWalletId === walletId || tx.toWalletId === walletId,
    );
  }
}
