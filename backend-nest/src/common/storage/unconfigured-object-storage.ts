import type { ObjectStorage, ObjectStorageUpload } from './object-storage.interface';
import { StorageConfigurationError } from './storage-configuration.error';

export class UnconfiguredObjectStorage implements ObjectStorage {
  async upload(_input: ObjectStorageUpload): Promise<void> { throw new StorageConfigurationError(); }
  async delete(_key: string): Promise<void> { throw new StorageConfigurationError(); }
  async getPublicUrl(_key: string): Promise<string> { throw new StorageConfigurationError(); }
}
