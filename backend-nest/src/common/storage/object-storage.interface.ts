export interface ObjectStorageUpload {
  key: string;
  body: Buffer;
  contentType?: string;
}

export interface ObjectStorage {
  upload(input: ObjectStorageUpload): Promise<void>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): Promise<string>;
}
