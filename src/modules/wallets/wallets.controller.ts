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

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  create(
    @Body('userId') userId: number,
    @Body('currency') currency: string,
    @Body('type') type: WalletType,
  ) {
    return this.walletsService.create(userId, currency, type);
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
  updateBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body('amount') amount: number,
  ) {
    return this.walletsService.updateBalance(id, amount);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: WalletStatus,
  ) {
    return this.walletsService.updateStatus(id, status);
  }
}
