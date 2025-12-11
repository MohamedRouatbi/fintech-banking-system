import { IsEnum } from 'class-validator';
import { TransactionStatus } from '../../../common/interfaces/transaction.interface';

export class UpdateTransactionStatusDto {
  @IsEnum(TransactionStatus)
  status: TransactionStatus;
}
