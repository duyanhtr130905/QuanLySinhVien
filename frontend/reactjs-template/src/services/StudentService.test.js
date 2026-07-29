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
