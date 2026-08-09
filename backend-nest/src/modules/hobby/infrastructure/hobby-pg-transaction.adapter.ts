import { Injectable } from '@nestjs/common';
import { PgTransactionManager } from '../../../common/database/pg-transaction-manager';
import type { HobbyPersistenceTransaction, HobbyTransactionPort } from '../domain/hobby-persistence.port';

@Injectable()
export class HobbyPgTransactionAdapter implements HobbyTransactionPort {
  constructor(private readonly transactions: PgTransactionManager) {}
  run<T>(work: (transaction: HobbyPersistenceTransaction) => Promise<T>): Promise<T> { return this.transactions.run((client) => work(client as HobbyPersistenceTransaction)); }
}
