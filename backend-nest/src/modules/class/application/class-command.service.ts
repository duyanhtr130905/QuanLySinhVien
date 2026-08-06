import { Injectable } from '@nestjs/common';
import { ForeignKeyViolationError, UniqueConstraintViolationError } from '../../../common/database/errors/database-infrastructure.error';
import { classException } from '../errors/class.errors';
import type { StudentClass } from '../domain/student-class.entity';
import type { CreateClassInput, UpdateClassInput } from '../http/class-request.parser';
import { ClassRepository } from '../infrastructure/class.repository';

const classCodeConstraint = 'tra_class_code_key';

@Injectable()
export class ClassCommandService {
  constructor(private readonly repository: ClassRepository) {}
  async create(input: CreateClassInput): Promise<{ id: string }> { try { return await this.repository.create(input); } catch (error) { if (error instanceof UniqueConstraintViolationError && error.constraint === classCodeConstraint) throw classException.createDuplicate(error); throw error; } }
  async update(id: number, input: UpdateClassInput): Promise<{ id: string }> { try { const updated = await this.repository.updateLegacy(id, input); if (!updated) throw classException.updateNotFound(); return updated; } catch (error) { if (error instanceof UniqueConstraintViolationError && error.constraint === classCodeConstraint) throw classException.updateDuplicate(error); throw error; } }
  async delete(id: number): Promise<StudentClass | null> { const exists = await this.repository.existsById(id); if (!exists) throw classException.deleteNotFound(); try { return await this.repository.deleteById(id); } catch (error) { if (error instanceof ForeignKeyViolationError) throw classException.deleteBlocked(error); throw error; } }
  deleteMany(ids: unknown[]) { return this.repository.deleteManyPartial(ids); }
}
