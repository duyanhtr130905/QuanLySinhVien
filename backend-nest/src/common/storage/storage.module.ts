import { Module } from '@nestjs/common';

/** Ports only: a concrete Supabase adapter belongs to a later migration phase. */
@Module({})
export class StorageModule {}
