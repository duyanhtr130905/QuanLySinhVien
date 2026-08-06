import fetch from 'auth/FetchInterceptor'
import HobbyService from './HobbyService'

jest.mock('auth/FetchInterceptor', () => jest.fn())

describe('HobbyService Nest-compatible routes', () => {
  beforeEach(() => fetch.mockReset())

  test('uses list, create, and delete routes exposed by Nest', () => {
    HobbyService.getAll()
    HobbyService.create('Read')
    HobbyService.destroy(7)

    expect(fetch).toHaveBeenNthCalledWith(1, { url: '/hobby/', method: 'get' })
    expect(fetch).toHaveBeenNthCalledWith(2, { url: '/hobby/', method: 'post', data: { name: 'Read' } })
    expect(fetch).toHaveBeenNthCalledWith(3, { url: '/hobby/7', method: 'delete' })
  })
})
