import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OBJECT_STORAGE } from './storage.tokens';
import { StudentModule } from '../../modules/student/student.module';

describe('StorageModule',()=>{it('resolves OBJECT_STORAGE for StudentModule consumers without calling Supabase',async()=>{const module=await Test.createTestingModule({imports:[ConfigModule.forRoot({isGlobal:true,ignoreEnvFile:true}),StudentModule]}).compile();expect(module.get(OBJECT_STORAGE)).toBeDefined();await module.close();});});
