import { Inject, Injectable } from '@nestjs/common';
import { STUDENT_COPY_PORT, type StudentCopyPort } from '../domain/student-persistence.port';

@Injectable()
export class StudentCopyService {
  constructor(@Inject(STUDENT_COPY_PORT) private readonly copies: StudentCopyPort) {}
  copyOne(id: number) { return this.copies.copyOne(id); }
  copyMany(ids: unknown[]) { return this.copies.copyMany(ids); }
  preview(ids: unknown[]) { return this.copies.preview(ids); }
  validate(drafts: unknown) { return this.copies.validate(drafts); }
  commit(drafts: unknown, files: Express.Multer.File[] = []) { return this.copies.commit(drafts, files); }
}
