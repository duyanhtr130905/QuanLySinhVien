import type { Pool, QueryResultRow } from 'pg';
import { PgExecutor } from './pg-executor.type';

export interface PgOrder {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface PgRepositoryMetadata {
  tableName: string;
  primaryKey: string;
  selectableColumns: readonly string[];
  insertableColumns: readonly string[];
  updatableColumns: readonly string[];
  searchableColumns: readonly string[];
  sortableColumns: readonly string[];
  defaultOrder: PgOrder;
}

export interface PgPaginationInput {
  page: number;
  size: number;
  search?: string;
  order?: PgOrder;
}

export interface PgPage<T> {
  page_info: { total_items: number; total_pages: number; current: number; size: number };
  records: T[];
}

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A small, allowlist-based PostgreSQL helper. It deliberately does not model
 * joins, soft deletion, entities, or module business rules.
 */
export abstract class BasePgRepository<T extends QueryResultRow = QueryResultRow> {
  protected constructor(
    protected readonly pool: Pool,
    protected readonly metadata: PgRepositoryMetadata,
  ) {
    this.assertMetadata();
  }

  async findAll(executor: PgExecutor = this.pool): Promise<T[]> {
    const result = await executor.query(`SELECT ${this.selectList()} FROM ${this.tableIdentifier()} ${this.orderClause(this.metadata.defaultOrder)}`);
    return result.rows.map((row) => this.mapRow(row as T));
  }

  async findById(id: unknown, executor: PgExecutor = this.pool): Promise<T | null> {
    const result = await executor.query(
      `SELECT ${this.selectList()} FROM ${this.tableIdentifier()} WHERE ${this.identifier(this.metadata.primaryKey)} = $1`,
      [id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0] as T) : null;
  }

  async existsById(id: unknown, executor: PgExecutor = this.pool): Promise<boolean> {
    const result = await executor.query(
      `SELECT 1 FROM ${this.tableIdentifier()} WHERE ${this.identifier(this.metadata.primaryKey)} = $1`,
      [id],
    );
    return result.rows.length > 0;
  }

  async paginate(input: PgPaginationInput, executor: PgExecutor = this.pool): Promise<PgPage<T>> {
    if (!Number.isSafeInteger(input.page) || input.page <= 0) throw new RangeError('page must be a positive integer');
    if (!Number.isSafeInteger(input.size) || input.size <= 0) throw new RangeError('size must be a positive integer');

    const where = this.searchClause(input.search);
    const order = input.order ?? this.metadata.defaultOrder;
    const countValues = [...where.values];
    const countResult = await executor.query(
      `SELECT COUNT(*)::int AS count FROM ${this.tableIdentifier()}${where.sql}`,
      countValues,
    );
    const pageValues = [...where.values, input.size, (input.page - 1) * input.size];
    const rowsResult = await executor.query(
      `SELECT ${this.selectList()} FROM ${this.tableIdentifier()}${where.sql} ${this.orderClause(order)} LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );
    const totalItems = Number(countResult.rows[0]?.count ?? 0);
    return {
      page_info: { total_items: totalItems, total_pages: Math.ceil(totalItems / input.size), current: input.page, size: input.size },
      records: rowsResult.rows.map((row) => this.mapRow(row as T)),
    };
  }

  async insert(values: Record<string, unknown>, executor: PgExecutor = this.pool): Promise<T> {
    const entries = this.writableEntries(values, this.metadata.insertableColumns);
    if (!entries.length) throw new Error('insert requires at least one allowed column');
    const columns = entries.map(([column]) => this.identifier(column));
    const params = entries.map((_, index) => `$${index + 1}`);
    const result = await executor.query(
      `INSERT INTO ${this.tableIdentifier()} (${columns.join(', ')}) VALUES (${params.join(', ')}) RETURNING ${this.selectList()}`,
      entries.map(([, value]) => value),
    );
    return this.mapRow(result.rows[0] as T);
  }

  async updateById(id: unknown, values: Record<string, unknown>, executor: PgExecutor = this.pool): Promise<T | null> {
    const entries = this.writableEntries(values, this.metadata.updatableColumns);
    if (!entries.length) throw new Error('update requires at least one allowed column');
    const assignments = entries.map(([column], index) => `${this.identifier(column)} = $${index + 1}`);
    const result = await executor.query(
      `UPDATE ${this.tableIdentifier()} SET ${assignments.join(', ')} WHERE ${this.identifier(this.metadata.primaryKey)} = $${entries.length + 1} RETURNING ${this.selectList()}`,
      [...entries.map(([, value]) => value), id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0] as T) : null;
  }

  async deleteById(id: unknown, executor: PgExecutor = this.pool): Promise<T | null> {
    const result = await executor.query(
      `DELETE FROM ${this.tableIdentifier()} WHERE ${this.identifier(this.metadata.primaryKey)} = $1 RETURNING ${this.selectList()}`,
      [id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0] as T) : null;
  }

  protected mapRow(row: T): T {
    return row;
  }

  private searchClause(search?: string): { sql: string; values: unknown[] } {
    if (!search || this.metadata.searchableColumns.length === 0) return { sql: '', values: [] };
    const expressions = this.metadata.searchableColumns.map((column) => `${this.identifier(column)} ILIKE $1`);
    return { sql: ` WHERE (${expressions.join(' OR ')})`, values: [`%${search}%`] };
  }

  private writableEntries(values: Record<string, unknown>, allowedColumns: readonly string[]): [string, unknown][] {
    for (const column of Object.keys(values)) {
      if (!allowedColumns.includes(column)) throw new Error(`column is not writable: ${column}`);
    }
    return Object.entries(values).filter(([, value]) => value !== undefined);
  }

  private selectList(): string {
    return this.metadata.selectableColumns.map((column) => this.identifier(column)).join(', ');
  }

  private orderClause(order: PgOrder): string {
    if (!this.metadata.sortableColumns.includes(order.column)) throw new Error(`column is not sortable: ${order.column}`);
    if (order.direction !== 'ASC' && order.direction !== 'DESC') throw new Error(`order direction is invalid: ${order.direction}`);
    return `ORDER BY ${this.identifier(order.column)} ${order.direction}`;
  }

  private tableIdentifier(): string {
    return this.identifier(this.metadata.tableName);
  }

  private identifier(value: string): string {
    if (!identifierPattern.test(value)) throw new Error(`invalid SQL identifier: ${value}`);
    return `"${value}"`;
  }

  private assertMetadata(): void {
    this.identifier(this.metadata.tableName);
    this.identifier(this.metadata.primaryKey);
    [
      this.metadata.selectableColumns,
      this.metadata.insertableColumns,
      this.metadata.updatableColumns,
      this.metadata.searchableColumns,
      this.metadata.sortableColumns,
    ].flat().forEach((column) => this.identifier(column));
    this.orderClause(this.metadata.defaultOrder);
  }
}
