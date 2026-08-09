import type { Student } from './student.entity';
import type { StudentPageQuery, StudentWriteInput } from './student.contracts';

/** Opaque transaction context owned by persistence adapters. */
export interface StudentPersistenceTransaction {
  readonly __studentPersistenceTransaction?: never;
}

export interface StudentTransactionPort {
  run<T>(work: (transaction: StudentPersistenceTransaction) => Promise<T>): Promise<T>;
}

export interface StudentRepositoryPort {
  findAll(columnlist?: string, transaction?: StudentPersistenceTransaction): Promise<Student[]>;
  findPage(query: StudentPageQuery, transaction?: StudentPersistenceTransaction): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: Student[] }>;
  findDeletedPage(query: StudentPageQuery, transaction?: StudentPersistenceTransaction): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: Student[] }>;
  findActiveById(id: number, transaction?: StudentPersistenceTransaction): Promise<Student | null>;
  activeHobbyMask(transaction?: StudentPersistenceTransaction): Promise<number>;
  create(input: StudentWriteInput, transaction?: StudentPersistenceTransaction): Promise<Student>;
  attachmentOfActive(id: number, transaction?: StudentPersistenceTransaction): Promise<string | null | undefined>;
  updateActive(id: number, input: StudentWriteInput, transaction?: StudentPersistenceTransaction): Promise<Student | null>;
  softDeleteActive(id: number, transaction?: StudentPersistenceTransaction): Promise<boolean>;
  restoreDeleted(id: number, transaction?: StudentPersistenceTransaction): Promise<'restored' | 'missing' | 'conflict'>;
  permanentlyDelete(id: number, transaction?: StudentPersistenceTransaction): Promise<{ attachment: string | null } | null>;
  countAttachmentReferences(attachment: string, transaction?: StudentPersistenceTransaction): Promise<number>;
}

export interface StudentAttachmentUpload { fieldname: string; mimetype: string; size: number; buffer: Buffer; originalname: string; }
export type StudentPersistenceRecord = Record<string, unknown>;
export interface StudentCopyValues { code: string; fullname: string; dob: string | null; sex: boolean | null; homecity: string | null; address: string | null; hair_color: string | null; email: string; facebook: string | null; class_id: number | null; username: string; description: string | null; hobbies: number; attachment: string | null; }
export interface StudentCopyDraft { draftKey: string; sourceId: number; values: StudentCopyValues; }
export interface StudentCopyPreview { drafts: StudentCopyDraft[]; notFoundIds: unknown[]; }
export interface StudentCopyCommit { created: Array<{ draftKey: string; record: StudentPersistenceRecord | undefined }>; }
export interface StudentImportFile { buffer: Buffer; contentType: string; filename: string; }
export interface StudentImportPreview { rows: StudentPersistenceRecord[]; }
export interface StudentImportCommit { created: StudentPersistenceRecord[]; updated: StudentPersistenceRecord[]; }

/** Persistence facts and mutations used by the Student copy workflow. */
export interface StudentCopySource extends StudentCopyValues { id: number; password: string; }
export interface StudentCopyInsert extends StudentCopyValues { password: string; }
export interface StudentCopyPersistencePort {
  findActiveSources(ids: number[], transaction?: StudentPersistenceTransaction): Promise<StudentCopySource[]>;
  findOccupiedUniqueValues(values: { code: string[]; username: string[]; email: string[] }, transaction?: StudentPersistenceTransaction): Promise<{ code: string[]; username: string[]; email: string[] }>;
  findExistingClassIds(ids: number[], transaction?: StudentPersistenceTransaction): Promise<number[]>;
  lockActiveSources(ids: number[], transaction: StudentPersistenceTransaction): Promise<StudentCopySource[]>;
  insertCopies(rows: StudentCopyInsert[], transaction: StudentPersistenceTransaction): Promise<StudentPersistenceRecord[]>;
}

/** Dedicated persistence boundary for Student import/export workflows. */
export interface StudentImportExportPort {
  template(type: unknown): Promise<StudentImportFile>;
  exportOne(id: number, type: unknown): Promise<StudentImportFile>;
  exportMany(ids: unknown[], type: unknown): Promise<StudentImportFile>;
  preview(buffer: Buffer, filename: string): Promise<StudentImportPreview>;
  validate(drafts: unknown): Promise<StudentImportPreview>;
  commit(drafts: unknown): Promise<StudentImportCommit>;
  commitSafe(drafts: unknown): Promise<StudentImportCommit>;
}

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY');
export const STUDENT_TRANSACTION = Symbol('STUDENT_TRANSACTION');
export const STUDENT_COPY_PERSISTENCE = Symbol('STUDENT_COPY_PERSISTENCE');
export const STUDENT_IMPORT_EXPORT_PORT = Symbol('STUDENT_IMPORT_EXPORT_PORT');
