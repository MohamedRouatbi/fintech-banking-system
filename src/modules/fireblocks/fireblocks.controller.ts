import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { FireblocksService } from './fireblocks.service';

@Controller('fireblocks')
export class FireblocksController {
  constructor(private readonly fireblocksService: FireblocksService) {}

  @Post('vaults')
  createVault(@Body('name') name: string) {
    return this.fireblocksService.createVault(name);
  }

  @Get('vaults')
  getVaults() {
    return this.fireblocksService.getVaults();
  }

  @Get('vaults/:vaultId')
  getVaultById(@Param('vaultId') vaultId: string) {
    return this.fireblocksService.getVaultById(vaultId);
  }

  @Get('vaults/:vaultId/balance/:assetId')
  getVaultBalance(
    @Param('vaultId') vaultId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.fireblocksService.getVaultBalance(vaultId, assetId);
  }

  @Post('transactions')
  createTransaction(
    @Body('assetId') assetId: string,
    @Body('sourceId') sourceId: string,
    @Body('destinationId') destinationId: string,
    @Body('amount') amount: string,
  ) {
    return this.fireblocksService.createTransaction(
      assetId,
      sourceId,
      destinationId,
      amount,
    );
  }

  @Get('transactions/:transactionId')
  getTransaction(@Param('transactionId') transactionId: string) {
    return this.fireblocksService.getTransaction(transactionId);
  }

  @Get('transactions')
  getTransactions(@Query('vaultId') vaultId?: string) {
    return this.fireblocksService.getTransactions(vaultId);
  }
}
