import { Injectable } from '@nestjs/common';
import {
  CheckConstraintViolationError,
  DatabaseInfrastructureError,
  DatabaseUnavailableError,
  ForeignKeyViolationError,
  NotNullViolationError,
  UniqueConstraintViolationError,
} from './errors/database-infrastructure.error';

interface PgErrorLike {
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
  message?: string;
}

const isPgErrorLike = (value: unknown): value is PgErrorLike => (
  typeof value === 'object' && value !== null && 'code' in value
);

@Injectable()
export class PgErrorTranslator {
  translate(error: unknown): Error {
    if (!isPgErrorLike(error)) return error instanceof Error ? error : new Error(String(error));

    const details = {
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      detail: error.detail,
    };
    const message = error.message ?? 'PostgreSQL error';
    const options = { cause: error };

    switch (error.code) {
      case '23505': return new UniqueConstraintViolationError(message, details, options);
      case '23503': return new ForeignKeyViolationError(message, details, options);
      case '23502': return new NotNullViolationError(message, details, options);
      case '23514': return new CheckConstraintViolationError(message, details, options);
      case '08000':
      case '08001':
      case '08003':
      case '08004':
      case '08006':
      case '57P01': return new DatabaseUnavailableError(message, details, options);
      default: return error instanceof Error ? error : new Error(message);
    }
  }
}
