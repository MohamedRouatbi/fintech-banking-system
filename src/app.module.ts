import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { BrokersModule } from './modules/brokers/brokers.module';
import { FireblocksModule } from './modules/fireblocks/fireblocks.module';
import { SecurityModule } from './modules/security/security.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AuditLogMiddleware } from './common/middleware/audit-log.middleware';
import { AuditService } from './common/services/audit.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // BullMQ for async job processing
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB') || 0,
        },
      }),
      inject: [ConfigService],
    }),
    // Rate limiting
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000, // 1 second
      limit: 10, // 10 requests per second
    }, {
      name: 'medium',
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }, {
      name: 'long',
      ttl: 900000, // 15 minutes
      limit: 1000, // 1000 requests per 15 minutes
    }]),
    AuthModule,
    UsersModule,
    TransactionsModule,
    WalletsModule,
    BrokersModule,
    FireblocksModule,
    SecurityModule,
    LedgerModule,
  ],
  controllers: [],
  providers: [
    AuditService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditLogMiddleware)
      .forRoutes('*');
  }
}
