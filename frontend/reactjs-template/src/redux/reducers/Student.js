import {
  STUDENT_LIST_FETCH, STUDENT_LIST_FETCH_SUCCESS, STUDENT_LIST_FETCH_FAIL,
  STUDENT_DETAIL_FETCH, STUDENT_DETAIL_FETCH_SUCCESS, STUDENT_DETAIL_FETCH_FAIL, STUDENT_DETAIL_CLEAR,
  STUDENT_CREATE, STUDENT_CREATE_SUCCESS, STUDENT_CREATE_FAIL,
  STUDENT_UPDATE, STUDENT_UPDATE_SUCCESS, STUDENT_UPDATE_FAIL,
  STUDENT_DELETE, STUDENT_DELETE_SUCCESS, STUDENT_DELETE_FAIL,
} from '../constants/Student'

const initState = {
  list: [],
  pageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
  listLoading: false,
  detail: null,
  detailLoading: false,
  submitLoading: false, // dùng chung cho create/update/delete — hiện loading trên nút Submit
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
      return { ...state, detailLoading: true, error: null }
    case STUDENT_DETAIL_FETCH_SUCCESS:
      return { ...state, detailLoading: false, detail: action.data }
    case STUDENT_DETAIL_FETCH_FAIL:
      return { ...state, detailLoading: false, error: action.message }
    case STUDENT_DETAIL_CLEAR:
      return { ...state, detail: null }

    case STUDENT_CREATE:
    case STUDENT_UPDATE:
    case STUDENT_DELETE:
      return { ...state, submitLoading: true, error: null }

    case STUDENT_CREATE_SUCCESS:
    case STUDENT_UPDATE_SUCCESS:
      return { ...state, submitLoading: false }
    case STUDENT_DELETE_SUCCESS:
      return {
        ...state,
        submitLoading: false,
        list: state.list.filter(s => s.id !== action.id),
      }

    case STUDENT_CREATE_FAIL:
    case STUDENT_UPDATE_FAIL:
    case STUDENT_DELETE_FAIL:
      return { ...state, submitLoading: false, error: action.message }

    default:
      return state
  }
}

export default student
