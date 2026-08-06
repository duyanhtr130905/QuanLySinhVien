import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ObjectStorage, ObjectStorageUpload } from './object-storage.interface';

export const STUDENT_ATTACHMENTS_BUCKET = 'student-attachments';
const keyPattern = /^students\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export class SupabaseObjectStorageAdapter implements ObjectStorage {
  private readonly origin: string;
  constructor(private readonly supabaseUrl: string, serviceRoleKey: string, private readonly client: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })) { this.origin = new URL(supabaseUrl).origin; }
  async upload(input: ObjectStorageUpload): Promise<void> { if (!this.isSafeKey(input.key)) throw new Error('Refusing to upload outside the student attachments prefix.'); const { error } = await this.client.storage.from(STUDENT_ATTACHMENTS_BUCKET).upload(input.key, input.body, { contentType: input.contentType, upsert: false }); if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`); }
  async delete(value: string): Promise<void> { const key = this.resolveKey(value); if (!key) return; const { error } = await this.client.storage.from(STUDENT_ATTACHMENTS_BUCKET).remove([key]); if (error) throw new Error(`Supabase Storage remove failed: ${error.message}`); }
  async getPublicUrl(key: string): Promise<string> { if (!this.isSafeKey(key)) throw new Error('Refusing to generate a public URL outside the student attachments prefix.'); const { data } = this.client.storage.from(STUDENT_ATTACHMENTS_BUCKET).getPublicUrl(key); return data.publicUrl; }
  private resolveKey(value: string): string | null { if (this.isSafeKey(value)) return value; try { const url = new URL(value); if (url.origin !== this.origin) return null; const prefix = `/storage/v1/object/public/${STUDENT_ATTACHMENTS_BUCKET}/`; if (!url.pathname.startsWith(prefix)) return null; const key = decodeURIComponent(url.pathname.slice(prefix.length)); return this.isSafeKey(key) ? key : null; } catch { return null; } }
  private isSafeKey(key: string): boolean { return keyPattern.test(key) && !key.includes('..'); }
}
