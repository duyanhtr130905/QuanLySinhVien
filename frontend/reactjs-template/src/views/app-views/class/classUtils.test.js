import {
  buildClassOrder, getChangedClassFields, normalizeMassClassCopyResponse,
  getSelectedClassesWithStudentsCount, isClassDeleteBlockedError, normalizeClassStudentCount,
  normalizeMassDeleteResponse, trimClassSearch, validateClassValues,
} from './classUtils'
import {
  buildDisplayedStudentRecords, getPageScopedSelectionChange,
} from '../student/studentUtils'

describe('class list helpers', () => {
  test('trims search and maps table sort fields to backend aliases', () => {
    expect(trimClassSearch('  CNTT  ')).toBe('CNTT')
    expect(buildClassOrder([
      { columnKey: 'code', order: 'descend' },
      { columnKey: 'name', order: 'ascend' },
      { columnKey: 'unknown', order: 'ascend' },
    ])).toBe('co:1-na:0')
  })

  test('normalizes the current mass-delete response and blocked IDs in its message', () => {
    expect(normalizeMassDeleteResponse({
      data: { ids: [1, 3] },
      message: 'Đã xóa 2 lớp. Không thể xóa 1 lớp (ids: 2)',
    })).toEqual({
      deletedIds: [1, 3],
      blockedIds: [2],
    })
  })

  test('also accepts explicit deletedIds and blockedIds response fields', () => {
    expect(normalizeMassDeleteResponse({
      data: { deletedIds: [4], blockedIds: [5] },
    })).toEqual({
      deletedIds: [4],
      blockedIds: [5],
    })
  })

  test('normalizes string student counts and identifies selected blocked classes', () => {
    expect(normalizeClassStudentCount({ student_count: '3' })).toBe(3)
    expect(normalizeClassStudentCount({ student_count: null })).toBe(0)
    expect(getSelectedClassesWithStudentsCount(
      [1, 2, 3],
      { 1: { student_count: '2' }, 2: { student_count: 0 }, 3: { student_count: '1' } }
    )).toBe(2)
  })

  test('recognizes a class delete conflict from the legacy code or HTTP status', () => {
    expect(isClassDeleteBlockedError({ code: 'G605' })).toBe(true)
    expect(isClassDeleteBlockedError({}, 409)).toBe(true)
    expect(isClassDeleteBlockedError({}, 400)).toBe(false)
  })

  test('normalizes partial mass-copy results from the backend message', () => {
    expect(normalizeMassClassCopyResponse({
      data: [{ id: 10, code: 'A_copy' }],
      message: 'Đã sao chép 1 lớp. Không tìm thấy ids: 99',
    })).toEqual({
      created: [{ id: 10, code: 'A_copy' }],
      notFound: [99],
    })
  })

  test('keeps selected records across pages without changing API records', () => {
    const pageRecords = [{ id: 3, code: 'C' }, { id: 4, code: 'D' }]
    const displayed = buildDisplayedStudentRecords(
      pageRecords,
      [1, 3],
      { 1: { id: 1, code: 'A' }, 3: pageRecords[0] }
    )
    expect(displayed.map(item => item.id)).toEqual([1, 3, 4])
    expect(pageRecords.map(item => item.id)).toEqual([3, 4])
  })

  test('select-all only changes records belonging to the current API page', () => {
    const change = getPageScopedSelectionChange({
      apiRecords: [{ id: 3 }, { id: 4 }],
      changeRows: [{ id: 1 }, { id: 3 }, { id: 4 }],
      selected: false,
      selectedRowKeys: [1, 3, 4],
    })
    expect(change.keys).toEqual([1])
  })
})

describe('class form helpers', () => {
  test('validates required and maximum-length fields after trimming', () => {
    expect(validateClassValues({ code: '   ', name: '  ' })).toEqual({
      code: 'Vui lòng nhập mã lớp',
      name: 'Vui lòng nhập tên lớp',
    })
    expect(validateClassValues({
      code: 'A'.repeat(51),
      name: 'B'.repeat(256),
    })).toEqual({
      code: 'Mã lớp không được vượt quá 50 ký tự',
      name: 'Tên lớp không được vượt quá 255 ký tự',
    })
  })

  test('builds a partial edit payload and ignores unchanged values/code', () => {
    const initial = { code: 'CNTT1', name: 'Công nghệ', description: null }
    expect(getChangedClassFields(initial, {
      code: 'DO_NOT_SEND',
      name: ' Công nghệ ',
      description: '',
    })).toEqual({})
    expect(getChangedClassFields(initial, {
      code: 'CNTT1',
      name: 'Công nghệ mới',
      description: ' Mô tả ',
    })).toEqual({
      name: 'Công nghệ mới',
      description: 'Mô tả',
    })
  })
})
