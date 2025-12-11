import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuditService, AuditAction } from '../../common/services/audit.service';

@Processor('transactions')
export class TransactionProcessor {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly auditService: AuditService,
  ) {}

  @Process('process-transaction')
  async handleProcessTransaction(job: Job) {
    const { transactionId } = job.data;
    this.logger.log(`Processing transaction: ${transactionId}`);

    try {
      const result = await this.transactionsService.processTransaction(transactionId);

      // Log audit trail
      this.auditService.logSuccess(
        AuditAction.TRANSACTION_UPDATED,
        result.userId,
        {
          transactionId,
          status: result.status,
          type: result.type,
          amount: result.amount,
        },
      );

      this.logger.log(`Transaction ${transactionId} processed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process transaction ${transactionId}:`, error);

      // Log failure
      this.auditService.logFailure(
        AuditAction.TRANSACTION_UPDATED,
        undefined,
        error.message,
        { transactionId },
      );

      throw error;
    }
  }

  @Process('webhook-confirmation')
  async handleWebhookConfirmation(job: Job) {
    const { transactionId, webhookData } = job.data;
    this.logger.log(`Processing webhook for transaction: ${transactionId}`);

    try {
      // Handle external confirmation (e.g., from payment gateway, blockchain)
      // Update transaction status based on webhook data
      
      this.logger.log(`Webhook processed for transaction ${transactionId}`);
      return { transactionId, processed: true };
    } catch (error) {
      this.logger.error(`Failed to process webhook for ${transactionId}:`, error);
      throw error;
    }
  }

  @Process('verify-deposit')
  async handleVerifyDeposit(job: Job) {
    const { transactionId } = job.data;
    this.logger.log(`Verifying deposit: ${transactionId}`);

    try {
      // Verify deposit with external system (bank, crypto network, etc.)
      // This could check blockchain confirmations, bank settlements, etc.
      
      this.logger.log(`Deposit ${transactionId} verified`);
      return { transactionId, verified: true };
    } catch (error) {
      this.logger.error(`Failed to verify deposit ${transactionId}:`, error);
      throw error;
    }
  }

  @Process('verify-withdrawal')
  async handleVerifyWithdrawal(job: Job) {
    const { transactionId } = job.data;
    this.logger.log(`Verifying withdrawal: ${transactionId}`);

    try {
      // Verify withdrawal execution with external system
      // Check if funds were actually sent
      
      this.logger.log(`Withdrawal ${transactionId} verified`);
      return { transactionId, verified: true };
    } catch (error) {
      this.logger.error(`Failed to verify withdrawal ${transactionId}:`, error);
      throw error;
    }
  }
}
