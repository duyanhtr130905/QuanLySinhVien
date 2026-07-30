export type ContractTargetName = 'legacy' | 'nest';
export type ContractTargetMode = ContractTargetName | 'both';

const supportedTargets: readonly ContractTargetMode[] = ['legacy', 'nest', 'both'];

export function parseContractTarget(value: string | undefined): ContractTargetMode {
  const target = value?.trim().toLowerCase() || 'both';

  if (supportedTargets.includes(target as ContractTargetMode)) {
    return target as ContractTargetMode;
  }

  throw new Error(
    `Invalid CONTRACT_TARGET "${value}". Expected one of: legacy, nest, both.`,
  );
}

export function selectTargetNames(target: ContractTargetMode): ContractTargetName[] {
  if (target === 'both') {
    return ['legacy', 'nest'];
  }

  return [target];
}
