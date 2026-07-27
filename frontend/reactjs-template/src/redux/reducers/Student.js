import {
  STUDENT_LIST_FETCH, STUDENT_LIST_FETCH_SUCCESS, STUDENT_LIST_FETCH_FAIL,
  STUDENT_DETAIL_FETCH, STUDENT_DETAIL_FETCH_SUCCESS, STUDENT_DETAIL_FETCH_FAIL, STUDENT_DETAIL_CLEAR,
  STUDENT_CREATE, STUDENT_CREATE_SUCCESS, STUDENT_CREATE_FAIL,
  STUDENT_UPDATE, STUDENT_UPDATE_SUCCESS, STUDENT_UPDATE_FAIL,
  STUDENT_DELETE, STUDENT_DELETE_SUCCESS, STUDENT_DELETE_FAIL,
  STUDENT_IMPORT, STUDENT_IMPORT_SUCCESS, STUDENT_IMPORT_FAIL, STUDENT_IMPORT_CLEAR,
} from '../constants/Student'

const initState = {
  list: [],
  pageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
  listLoading: false,
  detail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  importLoading: false,
  importResult: null,
  importError: null,
  error: null,
}

const student = (state = initState, action) => {
  switch (action.type) {
    case STUDENT_LIST_FETCH:
      return { ...state, listLoading: true, error: null }
    case STUDENT_LIST_FETCH_SUCCESS:
      return {
        ...state,
        listLoading: false,
        list: action.data.records,
        pageInfo: action.data.page_info,
      }
    case STUDENT_LIST_FETCH_FAIL:
      return { ...state, listLoading: false, error: action.message }

    case STUDENT_DETAIL_FETCH:
      return { ...state, detailLoading: true, detail: null, detailError: null, error: null }
    case STUDENT_DETAIL_FETCH_SUCCESS:
      return { ...state, detailLoading: false, detail: action.data, detailError: null }
    case STUDENT_DETAIL_FETCH_FAIL:
      return {
        ...state,
        detailLoading: false,
        detail: null,
        detailError: { message: action.message, status: action.status },
        error: action.message,
      }
    case STUDENT_DETAIL_CLEAR:
      return { ...state, detail: null, detailLoading: false, detailError: null }

    case STUDENT_IMPORT:
      return { ...state, importLoading: true, importResult: null, importError: null }
    case STUDENT_IMPORT_SUCCESS:
      return { ...state, importLoading: false, importResult: action.data, importError: null }
    case STUDENT_IMPORT_FAIL:
      return { ...state, importLoading: false, importError: action.message }
    case STUDENT_IMPORT_CLEAR:
      return { ...state, importLoading: false, importResult: null, importError: null }

    case STUDENT_CREATE:
      return { ...state, createLoading: true, error: null }
    case STUDENT_UPDATE:
      return { ...state, updateLoading: true, error: null }
    case STUDENT_DELETE:
      return { ...state, deleteLoading: true, error: null }

    case STUDENT_CREATE_SUCCESS:
      return { ...state, createLoading: false }
    case STUDENT_UPDATE_SUCCESS:
      return { ...state, updateLoading: false }
    case STUDENT_DELETE_SUCCESS:
      return {
        ...state,
        deleteLoading: false,
        list: state.list.filter(s => s.id !== action.id),
      }

    case STUDENT_CREATE_FAIL:
      return { ...state, createLoading: false, error: action.message }
    case STUDENT_UPDATE_FAIL:
      return { ...state, updateLoading: false, error: action.message }
    case STUDENT_DELETE_FAIL:
      return { ...state, deleteLoading: false, error: action.message }

    default:
      return state
  }
}

export default student
