import studentReducer from './Student'
import {
  STUDENT_CREATE, STUDENT_CREATE_SUCCESS, STUDENT_DELETE,
  STUDENT_DETAIL_FETCH, STUDENT_IMPORT
} from '../constants/Student'

describe('student reducer async state', () => {
  test('keeps create and delete loading states independent', () => {
    const initial = studentReducer(undefined, {})
    const creating = studentReducer(initial, { type: STUDENT_CREATE })
    const creatingAndDeleting = studentReducer(creating, { type: STUDENT_DELETE })
    const onlyDeleting = studentReducer(creatingAndDeleting, { type: STUDENT_CREATE_SUCCESS })

    expect(creating.createLoading).toBe(true)
    expect(creating.deleteLoading).toBe(false)
    expect(creatingAndDeleting.deleteLoading).toBe(true)
    expect(onlyDeleting.createLoading).toBe(false)
    expect(onlyDeleting.deleteLoading).toBe(true)
  })

  test('clears stale detail as soon as a new ID starts loading', () => {
    const state = {
      ...studentReducer(undefined, {}),
      detail: { id: 1, fullname: 'Sinh viên cũ' },
      detailError: { message: 'Lỗi cũ', status: 404 },
    }
    const next = studentReducer(state, { type: STUDENT_DETAIL_FETCH })

    expect(next.detail).toBeNull()
    expect(next.detailError).toBeNull()
    expect(next.detailLoading).toBe(true)
  })

  test('clears the previous import result when a new import starts', () => {
    const state = {
      ...studentReducer(undefined, {}),
      importResult: { created: [{ id: 1 }], failed: [] },
    }
    const next = studentReducer(state, { type: STUDENT_IMPORT })

    expect(next.importResult).toBeNull()
    expect(next.importLoading).toBe(true)
  })
})
