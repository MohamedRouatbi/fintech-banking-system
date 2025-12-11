import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, Min, IsUUID } from 'class-validator';
import { TransactionType } from '../../../common/interfaces/transaction.interface';

export class CreateTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @IsOptional()
  fromWalletId?: number;

  @IsNumber()
  @IsOptional()
  toWalletId?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  externalReference?: string;

  @IsOptional()
  metadata?: any;
}
