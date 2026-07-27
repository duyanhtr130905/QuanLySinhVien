import {
  CLASS_LIST_FETCH, CLASS_LIST_FETCH_SUCCESS, CLASS_LIST_FETCH_FAIL,
  CLASS_DETAIL_FETCH, CLASS_DETAIL_FETCH_SUCCESS, CLASS_DETAIL_FETCH_FAIL, CLASS_DETAIL_CLEAR,
  CLASS_CREATE, CLASS_CREATE_SUCCESS, CLASS_CREATE_FAIL,
  CLASS_UPDATE, CLASS_UPDATE_SUCCESS, CLASS_UPDATE_FAIL,
  CLASS_DELETE, CLASS_DELETE_SUCCESS, CLASS_DELETE_FAIL,
} from '../constants/Class'

const initialState = {
  list: [],
  pageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
  listLoading: false,
  detail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  error: null,
}

const classroom = (state = initialState, action) => {
  switch (action.type) {
    case CLASS_LIST_FETCH:
      return { ...state, listLoading: true, error: null }
    case CLASS_LIST_FETCH_SUCCESS:
      return {
        ...state,
        listLoading: false,
        list: Array.isArray(action.data?.records) ? action.data.records : [],
        pageInfo: action.data?.page_info || initialState.pageInfo,
      }
    case CLASS_LIST_FETCH_FAIL:
      return { ...state, listLoading: false, error: action.message }

    case CLASS_DETAIL_FETCH:
      return { ...state, detailLoading: true, detail: null, detailError: null }
    case CLASS_DETAIL_FETCH_SUCCESS:
      return { ...state, detailLoading: false, detail: action.data, detailError: null }
    case CLASS_DETAIL_FETCH_FAIL:
      return {
        ...state,
        detailLoading: false,
        detail: null,
        detailError: { message: action.message, status: action.status },
      }
    case CLASS_DETAIL_CLEAR:
      return { ...state, detail: null, detailLoading: false, detailError: null }

    case CLASS_CREATE:
      return { ...state, createLoading: true, error: null }
    case CLASS_CREATE_SUCCESS:
      return { ...state, createLoading: false }
    case CLASS_CREATE_FAIL:
      return { ...state, createLoading: false, error: action.message }

    case CLASS_UPDATE:
      return { ...state, updateLoading: true, error: null }
    case CLASS_UPDATE_SUCCESS:
      return { ...state, updateLoading: false }
    case CLASS_UPDATE_FAIL:
      return { ...state, updateLoading: false, error: action.message }

    case CLASS_DELETE:
      return { ...state, deleteLoading: true, error: null }
    case CLASS_DELETE_SUCCESS:
      return {
        ...state,
        deleteLoading: false,
        list: state.list.filter(item => item.id !== action.id),
      }
    case CLASS_DELETE_FAIL:
      return { ...state, deleteLoading: false, error: action.message }

    default:
      return state
  }
}

export default classroom
