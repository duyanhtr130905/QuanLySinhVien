import { createContractConfig, normalizeBaseUrl } from './contract-config';
import { parseContractTarget, selectTargetNames } from './contract-target';

describe('contract target configuration', () => {
  it('defaults CONTRACT_TARGET to both', () => {
    expect(parseContractTarget(undefined)).toBe('both');
  });

  it.each(['legacy', 'nest', 'both'])('accepts the %s target', (target) => {
    expect(parseContractTarget(target)).toBe(target);
  });

  it('rejects an invalid target', () => {
    expect(() => parseContractTarget('all')).toThrow(
      'Invalid CONTRACT_TARGET "all". Expected one of: legacy, nest, both.',
    );
  });

  it('selects the correct targets for each mode', () => {
    expect(selectTargetNames('legacy')).toEqual(['legacy']);
    expect(selectTargetNames('nest')).toEqual(['nest']);
    expect(selectTargetNames('both')).toEqual(['legacy', 'nest']);
  });

  it('normalizes trailing slashes', () => {
    expect(normalizeBaseUrl(' http://127.0.0.1:3002/// ', 'NEST_BASE_URL'))
      .toBe('http://127.0.0.1:3002');
  });

  it('fails clearly when a required URL is missing', () => {
    expect(() => createContractConfig({ CONTRACT_TARGET: 'legacy' })).toThrow(
      'LEGACY_BASE_URL is required when CONTRACT_TARGET is "legacy".',
    );
    expect(() => createContractConfig({ CONTRACT_TARGET: 'nest' })).toThrow(
      'NEST_BASE_URL is required when CONTRACT_TARGET is "nest".',
    );
  });

  it('only requires URLs for selected targets', () => {
    expect(createContractConfig({
      CONTRACT_TARGET: 'legacy',
      LEGACY_BASE_URL: 'http://127.0.0.1:3000/',
    }).targets).toEqual([{ name: 'legacy', baseUrl: 'http://127.0.0.1:3000' }]);
  });
});
