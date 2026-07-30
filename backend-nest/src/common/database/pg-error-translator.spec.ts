import {
  CheckConstraintViolationError,
  DatabaseUnavailableError,
  ForeignKeyViolationError,
  NotNullViolationError,
  UniqueConstraintViolationError,
} from './errors/database-infrastructure.error';
import { PgErrorTranslator } from './pg-error-translator';

describe('PgErrorTranslator', () => {
  const translator = new PgErrorTranslator();

  it.each([
    ['23505', UniqueConstraintViolationError],
    ['23503', ForeignKeyViolationError],
    ['23502', NotNullViolationError],
    ['23514', CheckConstraintViolationError],
    ['08006', DatabaseUnavailableError],
  ])('translates SQLSTATE %s', (code, ExpectedError) => {
    const source = { code, message: 'database failure', constraint: 'users_email_key', table: 'users', column: 'email', detail: 'detail' };
    const translated = translator.translate(source);

    expect(translated).toBeInstanceOf(ExpectedError);
    expect(translated).toMatchObject({ constraint: 'users_email_key', table: 'users', column: 'email', detail: 'detail' });
    expect((translated as Error & { cause?: unknown }).cause).toBe(source);
  });
});
