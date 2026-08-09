import { Inject, Injectable } from '@nestjs/common';
import { STUDENT_IMPORT_EXPORT_PORT, type StudentImportExportPort } from '../domain/student-persistence.port';

@Injectable()
export class StudentImportExportService {
  constructor(@Inject(STUDENT_IMPORT_EXPORT_PORT) private readonly imports: StudentImportExportPort) {}
  template(type: unknown) { return this.imports.template(type); }
  exportOne(id: number, type: unknown) { return this.imports.exportOne(id, type); }
  exportMany(ids: unknown[], type: unknown) { return this.imports.exportMany(ids, type); }
  preview(buffer: Buffer, filename: string) { return this.imports.preview(buffer, filename); }
  validate(drafts: unknown) { return this.imports.validate(drafts); }
  commit(drafts: unknown) { return this.imports.commit(drafts); }
  commitSafe(drafts: unknown) { return this.imports.commitSafe(drafts); }
}
