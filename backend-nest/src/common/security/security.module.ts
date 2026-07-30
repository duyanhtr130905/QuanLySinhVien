import { Module } from '@nestjs/common';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { PASSWORD_HASHER } from './security.tokens';

@Module({
  providers: [{ provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher }],
  exports: [PASSWORD_HASHER],
})
export class SecurityModule {}
