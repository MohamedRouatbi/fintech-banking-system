import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionProcessor } from './transaction.processor';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transactions',
    }),
    LedgerModule,
    WalletsModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionProcessor, AuditService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
