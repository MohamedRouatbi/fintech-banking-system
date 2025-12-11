import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

export enum WalletType {
  FIAT = 'FIAT',
  CRYPTO = 'CRYPTO',
}

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

// This is a mock service - replace with actual database integration
@Injectable()
export class WalletsService {
  private wallets: any[] = [];
  private idCounter = 1;

  async create(userId: number, currency: string, type: WalletType) {
    const newWallet = {
      id: this.idCounter++,
      userId,
      currency,
      type,
      balance: 0,
      status: WalletStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.wallets.push(newWallet);
    return newWallet;
  }

  async findAll(userId?: number) {
    if (userId) {
      return this.wallets.filter((wallet) => wallet.userId === userId);
    }
    return this.wallets;
  }

  async findOne(id: number) {
    const wallet = this.wallets.find((wallet) => wallet.id === id);
    
    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${id} not found`);
    }

    return wallet;
  }

  async updateBalance(id: number, amount: number) {
    const walletIndex = this.wallets.findIndex((wallet) => wallet.id === id);
    
    if (walletIndex === -1) {
      throw new NotFoundException(`Wallet with ID ${id} not found`);
    }

    const newBalance = this.wallets[walletIndex].balance + amount;

    if (newBalance < 0) {
      throw new BadRequestException('Insufficient balance');
    }

    this.wallets[walletIndex] = {
      ...this.wallets[walletIndex],
      balance: newBalance,
      updatedAt: new Date(),
    };

    return this.wallets[walletIndex];
  }

  async updateStatus(id: number, status: WalletStatus) {
    const walletIndex = this.wallets.findIndex((wallet) => wallet.id === id);
    
    if (walletIndex === -1) {
      throw new NotFoundException(`Wallet with ID ${id} not found`);
    }

    this.wallets[walletIndex] = {
      ...this.wallets[walletIndex],
      status,
      updatedAt: new Date(),
    };

    return this.wallets[walletIndex];
  }

  async getBalance(id: number): Promise<number> {
    const wallet = await this.findOne(id);
    return wallet.balance;
  }
}
