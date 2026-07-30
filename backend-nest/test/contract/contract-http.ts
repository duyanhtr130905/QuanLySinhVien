import type { ContractTarget } from './contract-config';

export interface ContractHttpResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

export interface ContractRequestOptions {
  method?: 'DELETE' | 'GET' | 'POST';
  body?: unknown;
}

export async function requestContractTarget(
  target: ContractTarget,
  path: string,
  timeoutMs: number,
  options: ContractRequestOptions = {},
): Promise<ContractHttpResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${target.baseUrl}${path}`, {
      method: options.method,
      headers: options.body === undefined
        ? { accept: 'application/json' }
        : { accept: 'application/json', 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => undefined);

    return { status: response.status, headers: response.headers, body };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const timeoutReason = error instanceof DOMException && error.name === 'AbortError'
      ? `timed out after ${timeoutMs}ms`
      : `connection error: ${reason}`;
    throw new Error(
      `Contract target "${target.name}" at ${target.baseUrl} is unavailable (${timeoutReason}).`,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}
