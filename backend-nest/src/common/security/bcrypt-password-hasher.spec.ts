import { BCRYPT_SALT_ROUNDS, BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes with legacy-compatible rounds and compares correctly', async () => {
    const hash = await hasher.hash('Aa1!abcd');

    expect(hash).not.toBe('Aa1!abcd');
    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${BCRYPT_SALT_ROUNDS.toString().padStart(2, '0')}\\$`));
    await expect(hasher.compare('Aa1!abcd', hash)).resolves.toBe(true);
    await expect(hasher.compare('wrong-password', hash)).resolves.toBe(false);
  });
});
