import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Student core application architecture',()=>{
  const coreFiles=['student-query.service.ts','student-command.service.ts','student-copy.service.ts','student-import-export.service.ts'];
  const forbidden=[/\.\.\/infrastructure\//, /PgTransactionManager/, /\bPG_POOL\b/, /from\s+['"]pg['"]/, /\bPoolClient\b/, /\bPool\b/, /\.query\(/, /\bSELECT\b/, /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/];

  it('keeps all Student application services independent from PostgreSQL and infrastructure imports',()=>{
    for(const file of coreFiles){
      const source=readFileSync(join(__dirname,file),'utf8');
      for(const pattern of forbidden)expect(source).not.toMatch(pattern);
    }
  });

  it('keeps the import/export adapter free of use-case and application concerns',()=>{
    const source=readFileSync(join(__dirname,'../infrastructure/student-postgres-import-export.adapter.ts'),'utf8');
    for(const pattern of [/FileCodecRegistry/, /PasswordHasher/, /LegacyApiException/, /\bcommitSafe\b/, /\bvalidate\(/, /\btemplate\(/, /\bpreview\(/, /toLocaleLowerCase/, /bcrypt/]) expect(source).not.toMatch(pattern);
  });
});
