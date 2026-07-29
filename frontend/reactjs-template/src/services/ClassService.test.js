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

  test('uses preview and explicit commit endpoints for draft copies', () => {
    const drafts = [{ draftKey: 'class-1', sourceId: 1, values: { code: 'C1-copy', name: 'A' } }]
    ClassService.copyPreview([1, 2])
    ClassService.commitCopyDrafts(drafts)
    expect(fetch).toHaveBeenNthCalledWith(1, {
      url: '/class/copy/preview', method: 'post', data: { idlist: [1, 2] },
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/class/copy/commit', method: 'post', data: { drafts },
    })
  })

  test('loads edit data from GET /class/:id', () => {
    ClassService.getById(2)
    expect(fetch).toHaveBeenCalledWith({
      url: '/class/2',
      method: 'get',
    })
  })

  test('uses only class-student relationship endpoints for detail membership flows', () => {
    const params = { page: 2, size: 5, search: 'An', order: 'fn:0', columnlist: 'id,fullname' }
    ClassService.getClassStudents(7, params)
    ClassService.getAvailableStudents(7, params)
    ClassService.addStudentsToClass(7, [3, 4])
    ClassService.removeStudentFromClass(7, 3)
    ClassService.removeStudentsFromClass(7, [3, 4])
    expect(fetch).toHaveBeenNthCalledWith(1, {
      url: '/class/7/students', method: 'get', params,
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/class/7/available-students', method: 'get', params,
    })
    expect(fetch).toHaveBeenNthCalledWith(3, {
      url: '/class/7/students', method: 'post', data: { studentIds: [3, 4] },
    })
    expect(fetch).toHaveBeenNthCalledWith(4, {
      url: '/class/7/students/3', method: 'delete',
    })
    expect(fetch).toHaveBeenNthCalledWith(5, {
      url: '/class/7/students/remove', method: 'patch', data: { studentIds: [3, 4] },
    })
    expect(fetch).not.toHaveBeenCalledWith(expect.objectContaining({ url: '/student/3', method: 'delete' }))
  })

  test('uses the Class copy, multipart import, and binary export contracts', () => {
    const formData = new FormData()
    formData.append('file', new Blob(['code,name'], { type: 'text/csv' }), 'classes.csv')
    ClassService.copyOne(7)
    ClassService.copyMany([7, 8])
    ClassService.importClasses(formData)
    ClassService.exportOne(7, 'csv')
    ClassService.exportMany([7, 8], 'xml')
    expect(fetch).toHaveBeenNthCalledWith(1, { url: '/class/copy/7', method: 'post' })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      url: '/class/copy', method: 'post', data: { idlist: [7, 8] },
    })
    expect(fetch).toHaveBeenNthCalledWith(3, {
      url: '/class/import', method: 'post', data: formData,
    })
    expect(fetch).toHaveBeenNthCalledWith(4, {
      url: '/class/export/7', method: 'get', params: { type: 'csv' }, responseType: 'blob', returnFullResponse: true,
    })
    expect(fetch).toHaveBeenNthCalledWith(5, {
      url: '/class/export', method: 'post', data: { idlist: [7, 8], type: 'xml' }, responseType: 'blob', returnFullResponse: true,
    })
  })
})
