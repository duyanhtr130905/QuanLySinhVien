import type { ClassRepository } from '../infrastructure/class.repository';
import { ClassQueryService } from './class-query.service';
describe('ClassQueryService', () => {
  it('passes list/page rows through without coercion and maps missing detail', async () => { const repository = { findAllWithStudentCount: jest.fn().mockResolvedValue([{ id: '1', student_count: '2' }]), findPageWithStudentCount: jest.fn().mockResolvedValue({ page_info: { total_items: 1 }, records: [] }), findByIdWithStudentCount: jest.fn().mockResolvedValue(null) }; const service = new ClassQueryService(repository as unknown as ClassRepository); await expect(service.getAll()).resolves.toEqual([{ id: '1', student_count: '2' }]); await expect(service.getPage({ page: 1, size: 1, toplist: [] })).resolves.toEqual({ page_info: { total_items: 1 }, records: [] }); await expect(service.getDetail(9)).rejects.toMatchObject({ code: 'D604' }); });
});
