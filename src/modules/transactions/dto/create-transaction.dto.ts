import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { TransactionType, AssetType } from '../../../common/interfaces/transaction.interface';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @IsEnum(AssetType)
  @IsNotEmpty()
  assetType: AssetType;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fee?: number;

  @IsNumber()
  @IsOptional()
  fromWalletId?: number;

  @IsNumber()
  @IsOptional()
  toWalletId?: number;

  @IsString()
  @IsOptional()
  fromAddress?: string;

  @IsString()
  @IsOptional()
  toAddress?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  externalReference?: string;

  @IsOptional()
  metadata?: any;
}
