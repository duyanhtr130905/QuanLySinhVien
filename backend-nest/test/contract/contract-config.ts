import {
  parseContractTarget,
  selectTargetNames,
  type ContractTargetMode,
  type ContractTargetName,
} from './contract-target';

const DEFAULT_TIMEOUT_MS = 5_000;

export interface ContractTarget {
  name: ContractTargetName;
  baseUrl: string;
}

export interface ContractConfig {
  mode: ContractTargetMode;
  targets: ContractTarget[];
  timeoutMs: number;
}

export function createContractConfig(
  env: NodeJS.ProcessEnv = process.env,
): ContractConfig {
  const mode = parseContractTarget(env.CONTRACT_TARGET);
  const targets = selectTargetNames(mode).map((name) => ({
    name,
    baseUrl: readBaseUrl(name, env),
  }));

  return { mode, targets, timeoutMs: DEFAULT_TIMEOUT_MS };
}

export function normalizeBaseUrl(value: string, variableName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${variableName} must be a non-empty absolute HTTP URL.`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${variableName} must be a valid absolute HTTP URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${variableName} must use http or https.`);
  }

  return trimmed.replace(/\/+$/, '');
}

function readBaseUrl(name: ContractTargetName, env: NodeJS.ProcessEnv): string {
  const variableName = name === 'legacy' ? 'LEGACY_BASE_URL' : 'NEST_BASE_URL';
  const value = env[variableName];

  if (!value?.trim()) {
    throw new Error(
      `${variableName} is required when CONTRACT_TARGET is "${env.CONTRACT_TARGET?.trim().toLowerCase() || 'both'}".`,
    );
  }

  return normalizeBaseUrl(value, variableName);
}
