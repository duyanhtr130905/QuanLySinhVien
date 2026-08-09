import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { HttpModule } from '../../common/http/http.module';
import { HobbyBitAllocator } from './application/hobby-bit-allocator';
import { HobbyService } from './application/hobby.service';
import { HobbyController } from './http/hobby.controller';
import { HobbyRepository } from './infrastructure/hobby.repository';
import { HobbyPgTransactionAdapter } from './infrastructure/hobby-pg-transaction.adapter';
import { HOBBY_PERSISTENCE, HOBBY_TRANSACTION } from './domain/hobby-persistence.port';

@Module({
  imports: [DatabaseModule, HttpModule],
  controllers: [HobbyController],
  providers: [HobbyBitAllocator, HobbyRepository, HobbyPgTransactionAdapter, { provide: HOBBY_PERSISTENCE, useExisting: HobbyRepository }, { provide: HOBBY_TRANSACTION, useExisting: HobbyPgTransactionAdapter }, HobbyService],
})
export class HobbyModule {}
