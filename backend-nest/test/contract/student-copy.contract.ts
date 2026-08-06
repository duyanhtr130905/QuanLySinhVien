import { createContractConfig, type ContractConfig, type ContractTarget } from './contract-config';
import { ContractFixtures } from './contract-fixtures';
import { requestContractTarget } from './contract-http';

type Envelope<T> = { code: string; status: number; message: string; data: T };
const request = (target: ContractTarget, config: ContractConfig, path: string, body?: unknown) => requestContractTarget(target, path, config.timeoutMs, { method: 'POST', body });
const success = <T>(response: Awaited<ReturnType<typeof request>>, message: string): Envelope<T> => { expect(response.status).toBe(200); expect(response.body).toMatchObject({ code: '200', status: 200, message }); return response.body as Envelope<T>; };
const copyPayload = (draft: { draftKey: string; sourceId: number; values: Record<string, unknown> }) => ({ drafts: [draft] });

describe.each(createContractConfig().targets)('student copy contract: %s', (target) => {
  const config = createContractConfig();
  let fixtures: ContractFixtures;
  beforeAll(() => { fixtures = new ContractFixtures(); });
  afterAll(async () => fixtures.cleanup(), 15_000);

  it('keeps single, bulk, preview, validate and commit routes in legacy envelopes', async () => {
    const suffix = `${target.name}-${Date.now().toString(36)}`;
    const sourceId = Number(await fixtures.studentCopy(suffix));
    const single = success<{ id: number }>(await request(target, config, `/student/copy/${sourceId}`), 'Sao chép sinh viên thành công');
    fixtures.trackStudent(single.data.id);
    expect(JSON.stringify(single.data)).not.toMatch(/password|hash/i);
    const bulk = success<Array<{ id: number }>>(await request(target, config, '/student/copy', { idlist: [sourceId, 2147483647] }), `Đã sao chép 1 sinh viên. Không tìm thấy ids: 2147483647`);
    bulk.data.forEach((record) => fixtures.trackStudent(record.id));
    const beforePreview = await fixtures.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM "tra_student" WHERE "id" = ANY($1::int[])', [[sourceId]]);
    const preview = success<{ drafts: Array<{ draftKey: string; sourceId: number; values: Record<string, unknown> }>; notFoundIds: unknown[] }>(await request(target, config, '/student/copy/preview', { idlist: [sourceId, sourceId, 2147483647] }), 'Đã tạo 1 draft sinh viên');
    const afterPreview = await fixtures.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM "tra_student" WHERE "id" = ANY($1::int[])', [[sourceId]]);
    expect(afterPreview.rows[0].count).toBe(beforePreview.rows[0].count);
    expect(preview.data.notFoundIds).toEqual([2147483647]);
    expect(preview.data.drafts).toHaveLength(1);
    expect(JSON.stringify(preview.data)).not.toMatch(/password|hash/i);
    const draft = preview.data.drafts[0];
    const beforeValidate = await fixtures.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM "tra_student"');
    const validation = success<{ rows: Array<{ draftKey: string; status: string; errors: Record<string, string> }> }>(await request(target, config, '/student/copy/validate', copyPayload(draft)), 'ÄÃ£ kiá»ƒm tra cÃ¡c báº£n sao sinh viÃªn');
    const afterValidate = await fixtures.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM "tra_student"');
    expect(afterValidate.rows[0].count).toBe(beforeValidate.rows[0].count);
    expect(validation.data.rows).toEqual([expect.objectContaining({ draftKey: draft.draftKey, status: 'valid', errors: {} })]);
    const duplicateValidation = success<{ rows: Array<{ draftKey: string; errors: Record<string, string> }> }>(await request(target, config, '/student/copy/validate', { drafts: [draft, { ...draft, draftKey: `${draft.draftKey}-duplicate` }] }), 'ÄÃ£ kiá»ƒm tra cÃ¡c báº£n sao sinh viÃªn');
    expect(duplicateValidation.data.rows.every((row) => row.errors.code && row.errors.email && row.errors.username)).toBe(true);
    const committed = success<{ created: Array<{ draftKey: string; record: { id: number } }> }>(await request(target, config, '/student/copy/commit', copyPayload({ ...draft, values: { ...draft.values, password: 'client-must-not-be-used', attachment: 'client-must-not-be-used' } })), 'Đã tạo 1 sinh viên');
    fixtures.trackStudent(committed.data.created[0].record.id);
    const hashes = await fixtures.query<{ id: number; password: string; attachment: string | null }>('SELECT "id", "password", "attachment" FROM "tra_student" WHERE "id" = ANY($1::int[]) ORDER BY "id"', [[sourceId, committed.data.created[0].record.id]]);
    expect(hashes.rows.map((row) => ({ ...row, id: Number(row.id) }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sourceId, password: 'copy-source-hash', attachment: `shared://copy-${suffix}` }),
      expect.objectContaining({ id: Number(committed.data.created[0].record.id), password: 'copy-source-hash', attachment: `shared://copy-${suffix}` }),
    ]));
  }, 30_000);

  it('rechecks vanished sources and conflicts after preview without a partial commit', async () => {
    const suffix = `${target.name}-race-${Date.now().toString(36)}`;
    const sourceId = Number(await fixtures.studentCopy(suffix));
    const preview = success<{ drafts: Array<{ draftKey: string; sourceId: number; values: Record<string, unknown> }> }>(await request(target, config, '/student/copy/preview', { idlist: [sourceId] }), 'Đã tạo 1 draft sinh viên');
    const draft = preview.data.drafts[0];
    const conflictId = Number(await fixtures.studentCopy(`${suffix}-conflict`));
    await fixtures.query('UPDATE "tra_student" SET "code"=$1, "email"=$2, "username"=$3 WHERE "id"=$4', [draft.values.code, draft.values.email, draft.values.username, conflictId]);
    const conflict = await request(target, config, '/student/copy/commit', copyPayload(draft));
    expect(conflict.status).toBe(400);
    expect(conflict.body).toMatchObject({ code: 'H603', status: 400 });
    await fixtures.query('DELETE FROM "tra_student" WHERE "id"=$1', [conflictId]);
    await fixtures.query('DELETE FROM "tra_student" WHERE "id"=$1 AND "deleted_at" IS NOT NULL', [conflictId]);
    await fixtures.query('DELETE FROM "tra_student" WHERE "id"=$1', [sourceId]);
    const missing = await request(target, config, '/student/copy/commit', copyPayload(draft));
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'H604', status: 404 });
  }, 30_000);
});
