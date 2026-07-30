import { Injectable } from '@nestjs/common';
import type { StudentClass } from '../domain/student-class.entity';
import { classException } from '../errors/class.errors';
import type { ClassPageQuery } from '../http/class-request.parser';
import { ClassRepository } from '../infrastructure/class.repository';

@Injectable()
export class ClassQueryService {
  constructor(private readonly repository: ClassRepository) {}
  getAll(columnlist?: string): Promise<StudentClass[]> { return this.repository.findAllWithStudentCount(columnlist); }
  getPage(query: ClassPageQuery) { return this.repository.findPageWithStudentCount(query); }
  async getDetail(id: number): Promise<StudentClass> { const record = await this.repository.findByIdWithStudentCount(id); if (!record) throw classException.detailNotFound(); return record; }
}
