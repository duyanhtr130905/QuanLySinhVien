import { StudentWritePolicy } from './student-write.policy';

describe('StudentWritePolicy', () => {
  const policy = new StudentWritePolicy();
  const create = { code: 'SV1', fullname: 'Student', email: 'student@example.test', username: 'student', password: 'Valid1!x' };

  const expectValidation = (body: Record<string, unknown>, createRequest: boolean, mask = 0) => {
    expect(() => policy.parse(body, createRequest, mask)).toThrow(expect.objectContaining({ code: createRequest ? 'E603' : 'F603', status: 400 }));
  };

  it('rejects invalid dates with the create and update legacy validation envelopes', () => {
    expectValidation({ ...create, dob: 'not-a-date' }, true);
    expectValidation({ dob: '2024-02-30' }, false);
  });

  it('only accepts boolean sex values when supplied', () => {
    expect(policy.parse({ ...create, sex: 'true' }, true, 0)).toMatchObject({ sex: true });
    expect(policy.parse({ sex: false }, false, 0)).toMatchObject({ sex: false });
    expectValidation({ ...create, sex: 'male' }, true);
    expectValidation({ sex: '1' }, false);
  });

  it('allows an empty hair color and rejects non-hex colors', () => {
    expect(policy.parse({ ...create, hair_color: '' }, true, 0)).toMatchObject({ hair_color: '' });
    expect(policy.parse({ hair_color: '#a1B2c3' }, false, 0)).toMatchObject({ hair_color: '#a1B2c3' });
    expectValidation({ ...create, hair_color: '#12345G' }, true);
    expectValidation({ hair_color: 'blue' }, false);
  });

  it('normalizes empty hobbies and strictly validates their active bit mask', () => {
    expect(policy.parse({ ...create, hobbies: '' }, true, 0)).toMatchObject({ hobbies: 0 });
    expect(policy.parse({ hobbies: '3' }, false, 3)).toMatchObject({ hobbies: 3 });
    expectValidation({ ...create, hobbies: '1x' }, true, 3);
    expectValidation({ hobbies: '4' }, false, 3);
  });

  it('normalizes empty and -1 class ids while rejecting non-positive or non-integer ids', () => {
    expect(policy.parse({ ...create, class_id: '' }, true, 0)).toMatchObject({ class_id: null });
    expect(policy.parse({ class_id: '-1' }, false, 0)).toMatchObject({ class_id: null });
    expect(policy.parse({ class_id: '42' }, false, 0)).toMatchObject({ class_id: 42 });
    expectValidation({ ...create, class_id: '1x' }, true);
    expectValidation({ class_id: '0' }, false);
  });

  it('preserves valid create and partial update behavior', () => {
    expect(policy.parse({ ...create, dob: '2000-02-29', sex: 'false', class_id: '2', hobbies: '3', hair_color: '#112233' }, true, 3)).toMatchObject({ dob: '2000-02-29', sex: false, class_id: 2, hobbies: 3 });
    expect(policy.parse({ fullname: 'Updated', dob: '' }, false, 0)).toEqual({ fullname: 'Updated', dob: null });
  });
});
