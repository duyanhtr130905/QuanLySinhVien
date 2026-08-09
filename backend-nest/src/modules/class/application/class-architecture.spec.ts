import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Class application architecture', () => {
  const services = ['class-command.service.ts', 'class-query.service.ts', 'class-copy.service.ts', 'class-membership.service.ts', 'class-import.service.ts', 'class-export.service.ts'];
  const forbidden = [/\.\.\/http\//, /\.\.\/infrastructure\//, /PgTransactionManager/, /\bPG_POOL\b/, /from\s+['"]pg['"]/, /\bPool(Client)?\b/, /\.query\(/, /\bSELECT\b/, /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/];

  it('keeps every Class application workflow independent from HTTP, PostgreSQL, and infrastructure', () => {
    for (const file of services) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      for (const pattern of forbidden) expect(source).not.toMatch(pattern);
    }
  });
});
