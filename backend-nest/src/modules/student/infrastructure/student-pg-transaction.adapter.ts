import { Injectable } from '@nestjs/common';
import { PgTransactionManager } from '../../../common/database/pg-transaction-manager';
import type { StudentPersistenceTransaction, StudentTransactionPort } from '../domain/student-persistence.port';

@Injectable()
export class StudentPgTransactionAdapter implements StudentTransactionPort {
  constructor(private readonly transactions: PgTransactionManager) {}

  run<T>(work: (transaction: StudentPersistenceTransaction) => Promise<T>): Promise<T> {
    return this.transactions.run((client) => work(client as StudentPersistenceTransaction));
  }
}
