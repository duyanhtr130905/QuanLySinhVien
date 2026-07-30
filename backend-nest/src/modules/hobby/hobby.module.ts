import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { HttpModule } from '../../common/http/http.module';
import { HobbyBitAllocator } from './application/hobby-bit-allocator';
import { HobbyService } from './application/hobby.service';
import { HobbyController } from './http/hobby.controller';
import { HobbyRepository } from './infrastructure/hobby.repository';

@Module({
  imports: [DatabaseModule, HttpModule],
  controllers: [HobbyController],
  providers: [HobbyBitAllocator, HobbyRepository, HobbyService],
})
export class HobbyModule {}
