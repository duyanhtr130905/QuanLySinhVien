import type { Pool } from 'pg';

/** A Pool or checked-out PoolClient that can execute parameterized queries. */
export type PgExecutor = Pick<Pool, 'query'>;
