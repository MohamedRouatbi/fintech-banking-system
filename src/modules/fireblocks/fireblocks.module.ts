import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FireblocksService } from './fireblocks.service';
import { FireblocksController } from './fireblocks.controller';

@Module({
  imports: [ConfigModule],
  controllers: [FireblocksController],
  providers: [FireblocksService],
  exports: [FireblocksService],
})
export class FireblocksModule {}
