import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { BrokersModule } from './modules/brokers/brokers.module';
import { FireblocksModule } from './modules/fireblocks/fireblocks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    TransactionsModule,
    WalletsModule,
    BrokersModule,
    FireblocksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
