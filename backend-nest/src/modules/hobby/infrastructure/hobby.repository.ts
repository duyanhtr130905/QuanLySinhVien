import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BasePgRepository, type PgRepositoryMetadata } from '../../../common/database/base-pg.repository';
import { PG_POOL } from '../../../common/database/database.tokens';
import { PgErrorTranslator } from '../../../common/database/pg-error-translator';
import type { PgExecutor } from '../../../common/database/pg-executor.type';
import type { Hobby } from '../domain/hobby.entity';
import { HobbyDuplicateError, type HobbyDuplicateField } from '../domain/hobby-persistence.port';
import { UniqueConstraintViolationError } from '../../../common/database/errors/database-infrastructure.error';

const hobbyMetadata: PgRepositoryMetadata = {
  tableName: 'tra_hobby',
  primaryKey: 'id',
  selectableColumns: ['id', 'code', 'name', 'bit_value', 'is_active'],
  insertableColumns: ['code', 'name', 'bit_value', 'is_active'],
  updatableColumns: [],
  searchableColumns: [],
  sortableColumns: ['bit_value'],
  defaultOrder: { column: 'bit_value', direction: 'ASC' },
};

// This fixed transaction-scoped lock serializes allocation across all hobby
// creates, so two requests cannot observe and select the same available bit.
const HOBBY_BIT_ALLOCATION_LOCK = 418_042;

@Injectable()
export class HobbyRepository extends BasePgRepository<Hobby> {
  constructor(
    @Inject(PG_POOL) pool: Pool,
    private readonly errors: PgErrorTranslator,
  ) {
    super(pool, hobbyMetadata);
  }

  async getActive(executor: PgExecutor = this.pool): Promise<Hobby[]> {
    return this.translate(async () => {
      const result = await executor.query(`
        SELECT "id", "code", "name", "bit_value", "is_active"
        FROM "tra_hobby"
        WHERE "is_active" = true
        ORDER BY "bit_value" ASC
      `);
      return result.rows as Hobby[];
    });
  }

  async lockBitAllocation(executor: PgExecutor): Promise<void> {
    await this.translate(async () => {
      await executor.query('SELECT pg_advisory_xact_lock($1)', [HOBBY_BIT_ALLOCATION_LOCK]);
    });
  }

  async getUsedBitValues(executor: PgExecutor = this.pool): Promise<number[]> {
    return this.translate(async () => {
      const result = await executor.query('SELECT "bit_value" FROM "tra_hobby"');
      return result.rows.map((row) => row.bit_value as number);
    });
  }

  async isUsedByActiveStudent(bitValue: number, executor: PgExecutor = this.pool): Promise<boolean> {
    return this.translate(async () => {
      const result = await executor.query(
        'SELECT 1 FROM "tra_student" WHERE ("hobbies" & $1) != 0 AND "deleted_at" IS NULL LIMIT 1',
        [bitValue],
      );
      return result.rows.length > 0;
    });
  }

  override async findById(id: unknown, executor: PgExecutor = this.pool): Promise<Hobby | null> {
    return this.translate(() => super.findById(id, executor));
  }

  override async insert(values: Record<string, unknown>, executor: PgExecutor = this.pool): Promise<Hobby> {
    return this.translate(() => super.insert(values, executor));
  }

  override async deleteById(id: unknown, executor: PgExecutor = this.pool): Promise<Hobby | null> {
    return this.translate(() => super.deleteById(id, executor));
  }

  private async translate<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      const translated = this.errors.translate(error);
      if (translated instanceof UniqueConstraintViolationError) throw new HobbyDuplicateError(this.duplicateField(translated.constraint), { cause: translated });
      throw translated;
    }
  }

  private duplicateField(constraint?: string): HobbyDuplicateField | undefined {
    return ({ tra_hobby_name_key: 'name', tra_hobby_code_key: 'code', tra_hobby_bit_value_key: 'bitValue' } as const)[constraint ?? ''];
  }
}
