import type { ContractConfig } from './contract-config';
import { requestContractTarget } from './contract-http';

const healthPayload = {
  status: 'ok',
  message: 'Quản lý Sinh viên API đang hoạt động',
};

export function registerGlobalContractSuite(config: ContractConfig): void {
  describe.each(config.targets)('global contract: %s', (target) => {
    beforeAll(async () => {
      await requestContractTarget(target, '/', config.timeoutMs);
    });

    it('returns the exact legacy health contract at GET /', async () => {
      const response = await requestContractTarget(target, '/', config.timeoutMs);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^application\/json\b/i);
      expect(response.body).toEqual(healthPayload);
      expect(response.body).not.toHaveProperty('code');
      expect(response.body).not.toHaveProperty('data');
    });

    it('has no global /api prefix', async () => {
      const response = await requestContractTarget(target, '/api', config.timeoutMs);

      expect(response.status).toBe(404);
    });
  });
}
