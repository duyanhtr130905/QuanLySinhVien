import fetch from 'auth/FetchInterceptor'
import StudentService from './StudentService'

jest.mock('auth/FetchInterceptor', () => jest.fn())

describe('StudentService trash contracts', () => {
  beforeEach(() => fetch.mockReset())

  test('uses the student trash page and mutation endpoints', () => {
    const params = { page: 2, size: 10, search: 'An', order: 'da:1' }
    StudentService.getDeletedByPage(params)
    StudentService.restoreDeleted([4, 8])
    StudentService.permanentlyDelete([4, 8])

    expect(fetch).toHaveBeenNthCalledWith(1, {
      url: '/student/deleted/page', method: 'get', params,
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/student/deleted/restore', method: 'patch', data: { idlist: [4, 8] },
    })
    expect(fetch).toHaveBeenNthCalledWith(3, {
      url: '/student/deleted/permanent', method: 'delete', data: { idlist: [4, 8] },
    })
  })
})

describe('StudentService copy preview contracts', () => {
  beforeEach(() => fetch.mockReset())

  test('uses read-only preview before the explicit commit request', () => {
    const drafts = [{ draftKey: 'student-1', sourceId: 1, values: { code: 'SV-copy' } }]
    StudentService.copyPreview([1, 2])
    StudentService.commitCopyDrafts(drafts)
    expect(fetch).toHaveBeenNthCalledWith(1, {
      url: '/student/copy/preview', method: 'post', data: { idlist: [1, 2] },
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/student/copy/commit', method: 'post', data: { drafts },
    })
    expect(fetch).not.toHaveBeenCalledWith(expect.objectContaining({ url: '/student/copy', method: 'post' }))
  })
})
