import { Inject, Injectable } from '@nestjs/common';
import type { StudentClass } from '../domain/student-class.entity';
import { CLASS_REPOSITORY, type ClassRepositoryPort } from '../domain/class-persistence.port';
import type { ClassPageQuery } from './class.contracts';
import { classApplicationException as classException } from './class-application.errors';

@Injectable()
export class ClassQueryService {
  constructor(@Inject(CLASS_REPOSITORY) private readonly repository: ClassRepositoryPort) {}
  getAll(columnlist?: string): Promise<StudentClass[]> { return this.repository.findAllWithStudentCount(columnlist); }
  getPage(query: ClassPageQuery) { return this.repository.findPageWithStudentCount(query); }
  async getDetail(id: number): Promise<StudentClass> { const record = await this.repository.findByIdWithStudentCount(id); if (!record) throw classException.detailNotFound(); return record; }
}
