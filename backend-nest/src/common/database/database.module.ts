import { Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './database.tokens';
import { PgErrorTranslator } from './pg-error-translator';
import { PgTransactionManager } from './pg-transaction-manager';

class DatabasePoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Pool({
        connectionString: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
      }),
    },
    DatabasePoolShutdown,
    PgTransactionManager,
    PgErrorTranslator,
  ],
  exports: [PG_POOL, PgTransactionManager, PgErrorTranslator],
})
export class DatabaseModule {}
