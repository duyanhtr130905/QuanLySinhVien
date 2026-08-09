import { ClassCopyService } from './class-copy.service';
import { ClassCodeConflictError } from './ports/class-persistence.port';
describe('ClassCopyService', () => {
  const subject = () => { const repository = { findForCopy: jest.fn(), codeExists: jest.fn(), insertCopy: jest.fn(), findCopySources: jest.fn(), codesInUse: jest.fn(), lockCopySources: jest.fn(), insertCopyDrafts: jest.fn() }; const transactions = { run: jest.fn(async (work) => work({ query: jest.fn() })) }; return { repository, service: new ClassCopyService(repository as never, transactions as never) }; };
  it('copies one with the legacy -copy code convention and keeps mass missing partial', async () => { const { repository, service } = subject(); repository.findForCopy.mockResolvedValueOnce({ id: '1', code: 'C1', name: 'A', description: null }).mockResolvedValueOnce(null); repository.codeExists.mockResolvedValue(false); repository.insertCopy.mockResolvedValue({ id: '2' }); await expect(service.copyOne(1)).resolves.toEqual({ id: '2' }); expect(repository.insertCopy).toHaveBeenCalledWith(expect.objectContaining({ code: 'C1-copy' })); await expect(service.copyMany([999])).rejects.toMatchObject({ code: 'H604' }); });
  it('keeps preview read-only and commit rechecks duplicate/source inside its transaction', async () => { const { repository, service } = subject(); repository.findCopySources.mockResolvedValue([{ id: '1', code: 'C1', name: 'A', description: null }]); repository.codesInUse.mockResolvedValue([]); await expect(service.preview([1])).resolves.toMatchObject({ drafts: [expect.objectContaining({ draftKey: 'class-1' })] }); expect(repository.insertCopy).not.toHaveBeenCalled(); repository.codesInUse.mockResolvedValue(['taken']); await expect(service.commit([{ draftKey: 'd', sourceId: 1, values: { code: 'taken', name: 'A' } }])).rejects.toMatchObject({ code: 'E603' }); });
  it('maps neutral copy-insert conflicts from direct and transactional races to the legacy duplicate contract', async () => {
    const direct = subject();
    direct.repository.findForCopy.mockResolvedValue({ id: '1', code: 'C1', name: 'A', description: null });
    direct.repository.codeExists.mockResolvedValue(false);
    direct.repository.insertCopy.mockRejectedValue(new ClassCodeConflictError());
    await expect(direct.service.copyOne(1)).rejects.toMatchObject({ status: 409, code: 'E603' });

    const transactional = subject();
    transactional.repository.codesInUse.mockResolvedValue([]);
    transactional.repository.lockCopySources.mockResolvedValue([1]);
    transactional.repository.insertCopyDrafts.mockRejectedValue(new ClassCodeConflictError());
    await expect(transactional.service.commit([{ draftKey: 'copy-1', sourceId: 1, values: { code: 'C1-copy', name: 'A' } }])).rejects.toMatchObject({ status: 409, code: 'E603' });
  });
});
