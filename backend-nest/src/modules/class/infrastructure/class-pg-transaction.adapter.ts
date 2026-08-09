import { Injectable } from '@nestjs/common';
import { PgTransactionManager } from '../../../common/database/pg-transaction-manager';
import type { ClassPersistenceTransaction, ClassTransactionPort } from '../application/ports/class-persistence.port';

@Injectable()
export class ClassPgTransactionAdapter implements ClassTransactionPort {
  constructor(private readonly transactions: PgTransactionManager) {}
  run<T>(work: (transaction: ClassPersistenceTransaction) => Promise<T>): Promise<T> { return this.transactions.run((client) => work(client as ClassPersistenceTransaction)); }
}
