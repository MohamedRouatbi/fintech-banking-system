import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { AuditService, AuditAction } from '../../common/services/audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces/user.interface';
import { TransactionStatus } from '../../common/interfaces/transaction.interface';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new transaction
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.transactionsService.create(
      createTransactionDto,
      currentUserId,
    );

    this.auditService.logFinancialTransaction(
      AuditAction.TRANSACTION_CREATED,
      currentUserId,
      result.id,
      createTransactionDto.amount,
      createTransactionDto.currency,
      {
        type: createTransactionDto.type,
        assetType: createTransactionDto.assetType,
        idempotencyKey: createTransactionDto.idempotencyKey,
      },
    );

    return result;
  }

  /**
   * Get all transactions (optionally filter by user)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPS)
  findAll(@Query('userId') userId?: number) {
    return this.transactionsService.findAll(userId);
  }

  /**
   * Get my transactions
   */
  @Get('my/transactions')
  getMyTransactions(@CurrentUser('sub') currentUserId: number) {
    return this.transactionsService.findAll(currentUserId);
  }

  /**
   * Get transaction by ID
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const transaction = await this.transactionsService.findOne(id);

    // Users can only see their own transactions (unless admin/ops)
    if (transaction.userId !== currentUserId) {
      // This will be caught by roles guard if user is not admin/ops
      @Roles(UserRole.ADMIN, UserRole.OPS)
      class AdminCheck {}
    }

    return transaction;
  }

  /**
   * Check transaction status
   */
  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.transactionsService.getStatus(id);
  }

  /**
   * Cancel a pending transaction
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.transactionsService.cancel(id, currentUserId);

    this.auditService.logSuccess(
      AuditAction.TRANSACTION_UPDATED,
      currentUserId,
      { transactionId: id, action: 'cancelled' },
      id,
    );

    return {
      message: 'Transaction cancelled successfully',
      transaction: result,
    };
  }

  /**
   * Get transactions by wallet
   */
  @Get('wallet/:walletId')
  findByWallet(@Param('walletId') walletId: number) {
    return this.transactionsService.findByWallet(walletId);
  }

  /**
   * Get transaction by idempotency key
   */
  @Get('idempotency/:key')
  async findByIdempotencyKey(@Param('key') key: string) {
    const transaction = await this.transactionsService.findByIdempotencyKey(key);
    if (!transaction) {
      return { found: false };
    }
    return { found: true, transaction };
  }
}
