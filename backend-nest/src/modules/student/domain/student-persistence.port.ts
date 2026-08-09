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

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY');
export const STUDENT_TRANSACTION = Symbol('STUDENT_TRANSACTION');
