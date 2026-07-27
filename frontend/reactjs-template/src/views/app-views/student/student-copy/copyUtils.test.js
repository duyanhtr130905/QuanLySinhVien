import {
  hasStoredCopyReference, normalizeMassCopyResponse, readCopyResultSession,
  rememberCopiedStudentId, saveCopyResultSession, unwrapCopiedStudent
} from './copyUtils'

describe('student copy helpers', () => {
  beforeEach(() => sessionStorage.clear())

  test('unwraps the copied record returned by copy one and strips sensitive fields', () => {
    expect(unwrapCopiedStudent({
      data: { id: 12, code: 'SV12', password: 'hash', deleted_at: null }
    })).toEqual({ id: 12, code: 'SV12' })
  })

  test('normalizes created and notFound object response', () => {
    expect(normalizeMassCopyResponse({
      data: {
        created: [{ id: 21, code: 'SV21' }, { id: 22, code: 'SV22' }],
        notFound: [5],
      }
    })).toEqual({
      created: [{ id: 21, code: 'SV21' }, { id: 22, code: 'SV22' }],
      notFound: [5],
    })
  })

  test('supports the current backend array response and reads missing IDs from its message', () => {
    expect(normalizeMassCopyResponse({
      data: [{ id: 31, code: 'SV31' }],
      message: 'Đã sao chép 1 sinh viên. Không tìm thấy ids: 7, 8',
    })).toEqual({
      created: [{ id: 31, code: 'SV31' }],
      notFound: [7, 8],
    })
  })

  test('stores only copied IDs and not sensitive record data for reload', () => {
    saveCopyResultSession({
      created: [{ id: 41, code: 'SV41', email: 'student@example.com' }],
      notFound: [9],
    })
    expect(readCopyResultSession()).toEqual({ createdIds: [41], notFound: [9] })
    expect(sessionStorage.getItem('student-copy-result')).not.toContain('student@example.com')
  })

  test('allows reloading only IDs that were returned by a copy flow', () => {
    rememberCopiedStudentId(51)
    saveCopyResultSession({ created: [{ id: 52 }], notFound: [] })

    expect(hasStoredCopyReference(51)).toBe(true)
    expect(hasStoredCopyReference(52)).toBe(true)
    expect(hasStoredCopyReference(5)).toBe(false)
  })
})
