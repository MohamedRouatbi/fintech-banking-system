import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { TransactionsService, TransactionStatus } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { AuditService, AuditAction } from '../../common/services/audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.transactionsService.create(createTransactionDto);
    this.auditService.logFinancialTransaction(
      AuditAction.TRANSACTION_CREATED,
      currentUserId,
      result.id,
      createTransactionDto.amount,
      createTransactionDto.currency,
      { type: createTransactionDto.type },
    );
    return result;
  }

  @Get()
  findAll(@Query('userId', ParseIntPipe) userId?: number) {
    return this.transactionsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: TransactionStatus,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.transactionsService.updateStatus(id, status);
    this.auditService.logSuccess(
      AuditAction.TRANSACTION_UPDATED,
      currentUserId,
      { transactionId: id, newStatus: status },
      id,
    );
    return result;
  }

  @Get('wallet/:walletId')
  findByWallet(@Param('walletId', ParseIntPipe) walletId: number) {
    return this.transactionsService.findByWallet(walletId);
  }
}
