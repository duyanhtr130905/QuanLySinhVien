import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE } from './storage.tokens';
import { StorageConfigurationError } from './storage-configuration.error';
import { SupabaseObjectStorageAdapter } from './supabase-object-storage.adapter';
import { UnconfiguredObjectStorage } from './unconfigured-object-storage';

@Module({ providers:[{ provide:OBJECT_STORAGE, inject:[ConfigService], useFactory:(config:ConfigService)=>{ const url=config.get<string>('SUPABASE_URL'); const key=config.get<string>('SUPABASE_SERVICE_ROLE_KEY'); if(url&&key)return new SupabaseObjectStorageAdapter(url,key); if(config.get<string>('NODE_ENV')==='production')throw new StorageConfigurationError(); return new UnconfiguredObjectStorage(); } }], exports:[OBJECT_STORAGE] })
export class StorageModule {}
