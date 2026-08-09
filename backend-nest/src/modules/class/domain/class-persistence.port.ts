import type { CopyDraft, ClassPageQuery, CreateClassInput, UpdateClassInput } from '../application/class.contracts';
import type { StudentClass } from './student-class.entity';
import type { StudentSummary } from './student-summary.entity';

export interface ClassPersistenceTransaction { readonly __classPersistenceTransaction?: never; }
export interface ClassTransactionPort { run<T>(work: (transaction: ClassPersistenceTransaction) => Promise<T>): Promise<T>; }

export class ClassCodeConflictError extends Error { constructor(options?: ErrorOptions) { super('Class code conflict', options); this.name = new.target.name; } }
export class ClassDeleteBlockedError extends Error { constructor(options?: ErrorOptions) { super('Class delete blocked', options); this.name = new.target.name; } }

export interface ClassRepositoryPort {
  findAllWithStudentCount(columnlist?: string, transaction?: ClassPersistenceTransaction): Promise<StudentClass[]>;
  findPageWithStudentCount(query: ClassPageQuery, transaction?: ClassPersistenceTransaction): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentClass[] }>;
  findByIdWithStudentCount(id: number, transaction?: ClassPersistenceTransaction): Promise<StudentClass | null>;
  create(input: CreateClassInput, transaction?: ClassPersistenceTransaction): Promise<{ id: string }>;
  updateLegacy(id: number, input: UpdateClassInput, transaction?: ClassPersistenceTransaction): Promise<{ id: string } | null>;
  existsById(id: number, transaction?: ClassPersistenceTransaction): Promise<boolean>;
  deleteById(id: number, transaction?: ClassPersistenceTransaction): Promise<StudentClass | null>;
  deleteManyPartial(ids: unknown[], transaction?: ClassPersistenceTransaction): Promise<{ deletedIds: unknown[]; blockedIds: unknown[] }>;
}

export interface ClassMembershipPersistencePort {
  existsById(id: number, transaction?: ClassPersistenceTransaction): Promise<boolean>;
  findStudentsByClass(classId: number, query: ClassPageQuery, transaction?: ClassPersistenceTransaction): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentSummary[] }>;
  findAvailableStudents(query: ClassPageQuery, transaction?: ClassPersistenceTransaction): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentSummary[] }>;
  lockClass(id: number, transaction: ClassPersistenceTransaction): Promise<boolean>;
  lockStudents(ids: number[], transaction: ClassPersistenceTransaction): Promise<Array<{ id: unknown; class_id: unknown; deleted_at: unknown }>>;
  assignStudents(classId: number, ids: number[], transaction: ClassPersistenceTransaction): Promise<void>;
  removeStudents(classId: number, ids: number[], transaction: ClassPersistenceTransaction): Promise<unknown[]>;
  findActiveStudent(id: number, transaction?: ClassPersistenceTransaction): Promise<{ id: unknown; class_id: unknown } | null>;
  removeStudent(classId: number, studentId: number, transaction?: ClassPersistenceTransaction): Promise<{ id: unknown } | null>;
}

export interface ClassCopyPersistencePort {
  findForCopy(id: number, transaction?: ClassPersistenceTransaction): Promise<StudentClass | null>;
  codeExists(code: string, transaction?: ClassPersistenceTransaction): Promise<boolean>;
  codesInUse(codes: string[], transaction?: ClassPersistenceTransaction): Promise<string[]>;
  insertCopy(values: { code: string; name: string; description?: unknown }, transaction?: ClassPersistenceTransaction): Promise<StudentClass>;
  findCopySources(ids: number[], transaction?: ClassPersistenceTransaction): Promise<StudentClass[]>;
  lockCopySources(ids: number[], transaction: ClassPersistenceTransaction): Promise<number[]>;
  insertCopyDrafts(drafts: CopyDraft[], transaction: ClassPersistenceTransaction): Promise<StudentClass[]>;
}

export interface ClassExportPersistencePort {
  findOneForExport(id: number, transaction?: ClassPersistenceTransaction): Promise<Record<string, unknown> | null>;
  findManyForExport(ids: unknown[], transaction?: ClassPersistenceTransaction): Promise<Record<string, unknown>[]>;
}

export const CLASS_REPOSITORY = Symbol('CLASS_REPOSITORY');
export const CLASS_TRANSACTION = Symbol('CLASS_TRANSACTION');
export const CLASS_MEMBERSHIP_PERSISTENCE = Symbol('CLASS_MEMBERSHIP_PERSISTENCE');
export const CLASS_COPY_PERSISTENCE = Symbol('CLASS_COPY_PERSISTENCE');
export const CLASS_EXPORT_PERSISTENCE = Symbol('CLASS_EXPORT_PERSISTENCE');
