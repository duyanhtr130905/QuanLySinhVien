import classReducer from './Class'
import {
  CLASS_CREATE, CLASS_DELETE, CLASS_DELETE_SUCCESS,
  CLASS_DETAIL_FETCH, CLASS_LIST_FETCH_SUCCESS, CLASS_UPDATE,
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
})
