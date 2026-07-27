import fetch from 'auth/FetchInterceptor'
import ClassService from './ClassService'

jest.mock('auth/FetchInterceptor', () => jest.fn())

describe('ClassService backend contracts', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  test('sends backend paging/search/order parameters to GET /class/page', () => {
    const params = {
      page: 2,
      size: 20,
      search: 'CNTT',
      order: 'co:1-na:0',
      columnlist: 'id,code,name,description',
    }
    ClassService.getByPage(params)
    expect(fetch).toHaveBeenCalledWith({
      url: '/class/page',
      method: 'get',
      params,
    })
  })

  test('uses JSON for create and partial update', () => {
    ClassService.create({ code: 'C1', name: 'Lớp 1', description: '' })
    ClassService.update(7, { name: 'Tên mới' })
    expect(fetch).toHaveBeenNthCalledWith(1, {
      url: '/class/',
      method: 'post',
      data: { code: 'C1', name: 'Lớp 1', description: '' },
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/class/7',
      method: 'put',
      data: { name: 'Tên mới' },
    })
  })

  test('uses ids for mass delete and idlist for mass copy', () => {
    ClassService.massDestroy([1, 2])
    ClassService.massCopy([1, 2])
    expect(fetch).toHaveBeenNthCalledWith(1, {
      url: '/class/delete',
      method: 'delete',
      data: { ids: [1, 2] },
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/class/copy',
      method: 'post',
      data: { idlist: [1, 2] },
    })
  })

  test('loads edit data from GET /class/ because GET /class/:id does not exist', async () => {
    fetch.mockResolvedValue({
      data: [
        { id: 1, code: 'A' },
        { id: 2, code: 'B' },
      ],
    })
    await expect(ClassService.getById(2)).resolves.toEqual({
      data: { id: 2, code: 'B' },
    })
    expect(fetch).toHaveBeenCalledWith({
      url: '/class/',
      method: 'get',
      params: {
        columnlist: 'id,code,name,description,created_at,updated_at',
      },
    })
  })

  test('rejects a missing ID without guessing a GET /class/:id endpoint', async () => {
    fetch.mockResolvedValue({ data: [] })
    await expect(ClassService.getById(99)).rejects.toMatchObject({
      response: {
        status: 404,
        data: { code: 'F604' },
      },
    })
  })
})
