import { StudentPostgresCopyAdapter } from './student-postgres-copy.adapter';
import { StudentCopyClassReferenceError, StudentCopyUniqueConflictError } from '../domain/student-persistence.port';

describe('StudentPostgresCopyAdapter', () => {
  it('translates PostgreSQL persistence errors at the adapter boundary', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce({ code: '23505', constraint: 'tra_student_email_key' }).mockRejectedValueOnce({ code: '23503', constraint: 'tra_student_class_id_fkey' }) };
    const adapter = new StudentPostgresCopyAdapter(pool as never);
    const row = { code: 'copy', fullname: 'Copy', dob: null, sex: null, homecity: null, address: null, hair_color: null, email: 'copy@example.test', facebook: null, class_id: null, username: 'copy', password: 'source-hash', description: null, hobbies: 0, attachment: null };
    await expect(adapter.insertCopies([row], undefined as never)).rejects.toMatchObject({ name: StudentCopyUniqueConflictError.name, field: 'email' });
    await expect(adapter.insertCopies([row], undefined as never)).rejects.toMatchObject({ name: StudentCopyClassReferenceError.name });
  });
});
