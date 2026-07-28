import classReducer from './Class'
import {
  CLASS_CREATE, CLASS_DELETE, CLASS_DELETE_SUCCESS,
  CLASS_COPY_MANY, CLASS_COPY_MANY_SUCCESS, CLASS_DETAIL_FETCH,
  CLASS_EXPORT_MANY, CLASS_EXPORT_MANY_SUCCESS, CLASS_IMPORT, CLASS_IMPORT_SUCCESS,
  CLASS_LIST_FETCH_SUCCESS, CLASS_UPDATE,
  CLASS_AVAILABLE_STUDENTS_CLEAR, CLASS_AVAILABLE_STUDENTS_FETCH_FAIL,
  CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS, CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
} from '../constants/Class'

describe('class reducer', () => {
  test('loads backend pagination without mixing selected UI records into the list', () => {
    const next = classReducer(undefined, {
      type: CLASS_LIST_FETCH_SUCCESS,
      data: {
        page_info: { total_items: 21, total_pages: 3, current: 2, size: 10 },
        records: [{ id: 11, code: 'C11' }],
      },
    })
    expect(next.list).toEqual([{ id: 11, code: 'C11' }])
    expect(next.pageInfo).toEqual({
      total_items: 21,
      total_pages: 3,
      current: 2,
      size: 10,
    })
  })

  test('keeps create, update and delete loading states independent', () => {
    const initial = classReducer(undefined, {})
    const creating = classReducer(initial, { type: CLASS_CREATE })
    const creatingAndUpdating = classReducer(creating, { type: CLASS_UPDATE })
    const allLoading = classReducer(creatingAndUpdating, { type: CLASS_DELETE })
    expect(allLoading.createLoading).toBe(true)
    expect(allLoading.updateLoading).toBe(true)
    expect(allLoading.deleteLoading).toBe(true)
  })

  test('removes only the successfully deleted class from the API page', () => {
    const state = {
      ...classReducer(undefined, {}),
      list: [{ id: 1 }, { id: 2 }],
      deleteLoading: true,
    }
    const next = classReducer(state, { type: CLASS_DELETE_SUCCESS, id: 1 })
    expect(next.list).toEqual([{ id: 2 }])
    expect(next.deleteLoading).toBe(false)
  })

  test('clears stale detail before loading another class', () => {
    const state = { ...classReducer(undefined, {}), detail: { id: 1 } }
    const next = classReducer(state, { type: CLASS_DETAIL_FETCH })
    expect(next.detail).toBeNull()
    expect(next.detailLoading).toBe(true)
  })

  test('keeps copy, import, and export state independent', () => {
    const initial = classReducer(undefined, {})
    const copying = classReducer(initial, { type: CLASS_COPY_MANY })
    const importing = classReducer(copying, { type: CLASS_IMPORT })
    const exporting = classReducer(importing, { type: CLASS_EXPORT_MANY })
    expect(exporting.copyManyLoading).toBe(true)
    expect(exporting.importLoading).toBe(true)
    expect(exporting.exportManyLoading).toBe(true)

    const copied = classReducer(exporting, { type: CLASS_COPY_MANY_SUCCESS, data: { created: [{ id: 9 }] } })
    const imported = classReducer(copied, { type: CLASS_IMPORT_SUCCESS, data: { created: [{ id: 10 }], failed: [] } })
    const exported = classReducer(imported, { type: CLASS_EXPORT_MANY_SUCCESS })
    expect(exported.copyResult).toEqual({ created: [{ id: 9 }] })
    expect(exported.importResult).toEqual({ created: [{ id: 10 }], failed: [] })
    expect(exported.exportManyLoading).toBe(false)
  })

  test('keeps selected available-student records separate from the API page', () => {
    const initial = classReducer(undefined, {})
    const selected = classReducer(initial, {
      type: CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
      ids: ['2', 3, 2, 'invalid'],
      recordsById: { 2: { id: 2, fullname: 'An' }, 3: { id: 3, fullname: 'Binh' } },
    })
    expect(selected.selectedAvailableStudentIds).toEqual(['2', '3'])
    expect(selected.selectedAvailableStudentsById).toEqual({
      2: { id: 2, fullname: 'An' },
      3: { id: 3, fullname: 'Binh' },
    })

    const cleared = classReducer(selected, { type: CLASS_AVAILABLE_STUDENTS_CLEAR })
    expect(cleared.selectedAvailableStudentIds).toEqual([])
    expect(cleared.selectedAvailableStudentsById).toEqual({})
  })

  test('retains string-key selection when a new available-student page loads or fails', () => {
    const selected = classReducer(undefined, {
      type: CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
      ids: ['2'],
      recordsById: { 2: { id: 2, fullname: 'An' } },
    })
    const nextPage = classReducer(selected, {
      type: CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS,
      data: { records: [{ id: '3', fullname: 'Binh' }], page_info: { current: 2, size: 10 } },
    })
    const failed = classReducer(nextPage, {
      type: CLASS_AVAILABLE_STUDENTS_FETCH_FAIL,
      message: 'Lỗi tải trang',
    })
    expect(failed.selectedAvailableStudentIds).toEqual(['2'])
    expect(failed.selectedAvailableStudentsById).toEqual({ 2: { id: 2, fullname: 'An' } })
  })
})
