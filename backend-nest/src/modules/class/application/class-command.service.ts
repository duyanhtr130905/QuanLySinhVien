import { Inject, Injectable } from '@nestjs/common';
import { CLASS_REPOSITORY, ClassCodeConflictError, ClassDeleteBlockedError, type ClassRepositoryPort } from '../domain/class-persistence.port';
import type { StudentClass } from '../domain/student-class.entity';
import type { CreateClassInput, UpdateClassInput } from './class.contracts';
import { classApplicationException as classException } from './class-application.errors';

@Injectable()
export class ClassCommandService {
  constructor(@Inject(CLASS_REPOSITORY) private readonly repository: ClassRepositoryPort) {}
  async create(input: CreateClassInput): Promise<{ id: string }> { try { return await this.repository.create(input); } catch (error) { if (error instanceof ClassCodeConflictError) throw classException.createDuplicate(error); throw error; } }
  async update(id: number, input: UpdateClassInput): Promise<{ id: string }> { try { const updated = await this.repository.updateLegacy(id, input); if (!updated) throw classException.updateNotFound(); return updated; } catch (error) { if (error instanceof ClassCodeConflictError) throw classException.updateDuplicate(error); throw error; } }
  async delete(id: number): Promise<StudentClass | null> { const exists = await this.repository.existsById(id); if (!exists) throw classException.deleteNotFound(); try { return await this.repository.deleteById(id); } catch (error) { if (error instanceof ClassDeleteBlockedError) throw classException.deleteBlocked(error); throw error; } }
  deleteMany(ids: unknown[]) { return this.repository.deleteManyPartial(ids); }
}
