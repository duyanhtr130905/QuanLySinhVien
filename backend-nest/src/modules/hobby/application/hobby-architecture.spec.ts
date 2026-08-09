import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Hobby application architecture', () => {
  it('uses application contracts and focused ports without HTTP or PostgreSQL coupling', () => {
    const source = readFileSync(join(__dirname, 'hobby.service.ts'), 'utf8');
    for (const pattern of [/CreateHobbyDto/, /HobbyRepository/, /PgTransactionManager/, /\.\.\/http\//, /\.\.\/infrastructure\//, /from\s+['"]pg['"]/, /\.query\(/, /\bSELECT\b/, /\bINSERT\b/, /\bDELETE\b/]) expect(source).not.toMatch(pattern);
  });
});
