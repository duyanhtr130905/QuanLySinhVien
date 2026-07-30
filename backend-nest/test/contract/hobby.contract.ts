import type { ContractConfig, ContractTarget } from './contract-config';
import { createContractConfig } from './contract-config';
import { requestContractTarget, type ContractHttpResponse } from './contract-http';

const listMessage = 'Lấy danh sách sở thích thành công';
const createMessage = 'Tạo sở thích thành công';
const deleteMessage = 'Xóa sở thích thành công';

type HobbyPayload = {
  id: string;
  code: string;
  name: string;
  bit_value: number;
  is_active: boolean;
};

type LegacyEnvelope<T> = {
  code: string;
  status: number;
  message: string;
  data: T;
};

const readEnvelope = <T>(response: ContractHttpResponse): LegacyEnvelope<T> => response.body as LegacyEnvelope<T>;

const expectEnvelope = <T>(
  response: ContractHttpResponse,
  status: number,
  code: string,
  message: string,
): LegacyEnvelope<T> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toMatch(/^application\/json\b/i);
  const body = readEnvelope<T>(response);
  expect(Object.keys(body).sort()).toEqual(['code', 'data', 'message', 'status']);
  expect(body.code).toBe(code);
  expect(body.status).toBe(status);
  expect(body.message).toBe(message);
  return body;
};

const requestHobby = (
  target: ContractTarget,
  path: string,
  config: ContractConfig,
  method: 'DELETE' | 'GET' | 'POST' = 'GET',
  body?: unknown,
) => requestContractTarget(target, path, config.timeoutMs, { method, body });

function assertHobbyShape(hobby: HobbyPayload): void {
  expect(Object.keys(hobby).sort()).toEqual(['bit_value', 'code', 'id', 'is_active', 'name']);
  expect(typeof hobby.id).toBe('string');
  expect(typeof hobby.code).toBe('string');
  expect(typeof hobby.name).toBe('string');
  expect(typeof hobby.bit_value).toBe('number');
  expect(typeof hobby.is_active).toBe('boolean');
}

function assertPowerOfTwo(bitValue: number): void {
  expect(Number.isSafeInteger(bitValue)).toBe(true);
  expect(bitValue).toBeGreaterThanOrEqual(1);
  expect(bitValue).toBeLessThanOrEqual(2 ** 30);
  expect((bitValue & (bitValue - 1)) === 0).toBe(true);
}

export function registerHobbyContractSuite(config: ContractConfig): void {
  describe.each(config.targets)('hobby contract: %s', (target) => {
    it('lists active hobbies in legacy envelope and bit order', async () => {
      const response = await requestHobby(target, '/hobby', config);
      const body = expectEnvelope<HobbyPayload[]>(response, 200, '200', listMessage);

      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach(assertHobbyShape);
      expect(body.data.map((hobby) => hobby.bit_value)).toEqual([...body.data]
        .sort((left, right) => left.bit_value - right.bit_value)
        .map((hobby) => hobby.bit_value));
    });

    it.each([
      [{}, 'name là bắt buộc và không được để trống'],
      [{ name: '   ' }, 'name là bắt buộc và không được để trống'],
      [{ name: 'x'.repeat(31) }, 'name không được vượt quá 30 ký tự'],
    ])('keeps legacy create validation for %j', async (input, message) => {
      const response = await requestHobby(target, '/hobby', config, 'POST', input);
      const body = expectEnvelope<null>(response, 400, 'E603', message);
      expect(body.data).toBeNull();
    });

    it('keeps legacy validation for invalid delete ids', async () => {
      const response = await requestHobby(target, '/hobby/not-an-id', config, 'DELETE');
      const body = expectEnvelope<null>(response, 400, 'G601', 'id không hợp lệ');
      expect(body.data).toBeNull();
    });

    it('creates, detects duplicate names, deletes, and reports not-found without fixed ids', async () => {
      const name = `h-${target.name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      let created: HobbyPayload | undefined;

      try {
        const createResponse = await requestHobby(target, '/hobby', config, 'POST', { name: `  ${name}  ` });
        const possibleCreated = readEnvelope<Partial<HobbyPayload>>(createResponse).data;
        if (possibleCreated && typeof possibleCreated.id === 'string') {
          created = possibleCreated as HobbyPayload;
        }
        const createBody = expectEnvelope<HobbyPayload>(createResponse, 200, '200', createMessage);
        created = createBody.data;
        assertHobbyShape(created);
        expect(created.name).toBe(name);
        assertPowerOfTwo(created.bit_value);
        expect(created.code).toBe(`HB${created.bit_value}`);

        const duplicateResponse = await requestHobby(target, '/hobby', config, 'POST', { name });
        const duplicateBody = expectEnvelope<null>(duplicateResponse, 409, 'E603', 'Tên sở thích đã tồn tại');
        expect(duplicateBody.data).toBeNull();

        const deleteResponse = await requestHobby(target, `/hobby/${created.id}`, config, 'DELETE');
        const deleteBody = expectEnvelope<{ id: string }>(deleteResponse, 200, '200', deleteMessage);
        expect(deleteBody.data).toEqual({ id: created.id });
        const deletedId = created.id;
        created = undefined;

        const missingResponse = await requestHobby(target, `/hobby/${deletedId}`, config, 'DELETE');
        const missingBody = expectEnvelope<null>(missingResponse, 404, 'G604', 'Không tìm thấy hobby');
        expect(missingBody.data).toBeNull();
      } finally {
        if (created) {
          await requestHobby(target, `/hobby/${created.id}`, config, 'DELETE').catch(() => undefined);
        }
      }
    });
  });
}

registerHobbyContractSuite(createContractConfig());
