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
import { WalletsService, WalletType, WalletStatus } from './wallets.service';
import { AuditService, AuditAction } from '../../common/services/audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(
    @Body('userId') userId: number,
    @Body('currency') currency: string,
    @Body('type') type: WalletType,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.walletsService.create(userId, currency, type);
    this.auditService.logSuccess(
      AuditAction.WALLET_CREATED,
      currentUserId,
      { walletId: result.id, currency, type },
      result.id,
    );
    return result;
  }

  @Get()
  findAll(@Query('userId', ParseIntPipe) userId?: number) {
    return this.walletsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.walletsService.findOne(id);
  }

  @Get(':id/balance')
  getBalance(@Param('id', ParseIntPipe) id: number) {
    return this.walletsService.getBalance(id);
  }

  @Patch(':id/balance')
  async updateBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body('amount') amount: number,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.walletsService.updateBalance(id, amount);
    this.auditService.logSuccess(
      AuditAction.WALLET_BALANCE_UPDATED,
      currentUserId,
      { walletId: id, amount, newBalance: result.balance },
      id,
    );
    return result;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: WalletStatus,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.walletsService.updateStatus(id, status);
    this.auditService.logSuccess(
      AuditAction.WALLET_STATUS_CHANGED,
      currentUserId,
      { walletId: id, newStatus: status },
      id,
    );
    return result;
  }
}
