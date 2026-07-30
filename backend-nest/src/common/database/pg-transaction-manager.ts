import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from './database.tokens';

@Injectable()
export class PgTransactionManager {
  private readonly logger = new Logger(PgTransactionManager.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async run<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.recordRollbackError(error, rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private recordRollbackError(error: unknown, rollbackError: unknown): void {
    if (typeof error === 'object' && error !== null) {
      try {
        Object.defineProperty(error, 'rollbackError', {
          value: rollbackError,
          configurable: true,
        });
        return;
      } catch {
        // Preserve the original transaction failure even if it cannot be annotated.
      }
    }

    this.logger.error(
      'ROLLBACK failed while preserving the original transaction failure.',
      rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
    );
  }
}
