import { IsEnum } from 'class-validator';
import { TransactionStatus } from '../../../common/interfaces/transaction.interface';

export class CancelTransactionDto {
  @IsEnum(TransactionStatus)
  status: TransactionStatus.CANCELLED;
}
