import type { Hobby } from './hobby.entity';

export interface HobbyPersistenceTransaction { readonly __hobbyPersistenceTransaction?: never; }
export interface HobbyTransactionPort { run<T>(work: (transaction: HobbyPersistenceTransaction) => Promise<T>): Promise<T>; }

export type HobbyDuplicateField = 'name' | 'code' | 'bitValue';
export class HobbyDuplicateError extends Error {
  constructor(readonly field?: HobbyDuplicateField, options?: ErrorOptions) { super('Hobby duplicate', options); this.name = new.target.name; }
}

export interface HobbyPersistencePort {
  getActive(transaction?: HobbyPersistenceTransaction): Promise<Hobby[]>;
  lockBitAllocation(transaction: HobbyPersistenceTransaction): Promise<void>;
  getUsedBitValues(transaction?: HobbyPersistenceTransaction): Promise<number[]>;
  insert(values: { code: string; name: string; bit_value: number; is_active: boolean }, transaction?: HobbyPersistenceTransaction): Promise<Hobby>;
  findById(id: number, transaction?: HobbyPersistenceTransaction): Promise<Hobby | null>;
  isUsedByActiveStudent(bitValue: number, transaction?: HobbyPersistenceTransaction): Promise<boolean>;
  deleteById(id: number, transaction?: HobbyPersistenceTransaction): Promise<Hobby | null>;
}

export const HOBBY_PERSISTENCE = Symbol('HOBBY_PERSISTENCE');
export const HOBBY_TRANSACTION = Symbol('HOBBY_TRANSACTION');
