import {
  CLASS_LIST_FETCH, CLASS_LIST_FETCH_SUCCESS, CLASS_LIST_FETCH_FAIL,
  CLASS_DETAIL_FETCH, CLASS_DETAIL_FETCH_SUCCESS, CLASS_DETAIL_FETCH_FAIL, CLASS_DETAIL_CLEAR,
  CLASS_CREATE, CLASS_CREATE_SUCCESS, CLASS_CREATE_FAIL,
  CLASS_UPDATE, CLASS_UPDATE_SUCCESS, CLASS_UPDATE_FAIL,
  CLASS_DELETE, CLASS_DELETE_SUCCESS, CLASS_DELETE_FAIL,
  CLASS_MASS_DELETE, CLASS_MASS_DELETE_SUCCESS, CLASS_MASS_DELETE_FAIL,
  CLASS_STUDENTS_FETCH, CLASS_STUDENTS_FETCH_SUCCESS, CLASS_STUDENTS_FETCH_FAIL, CLASS_STUDENTS_CLEAR,
  CLASS_AVAILABLE_STUDENTS_FETCH, CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS, CLASS_AVAILABLE_STUDENTS_FETCH_FAIL,
  CLASS_AVAILABLE_STUDENTS_CLEAR, CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
  CLASS_STUDENTS_ADD, CLASS_STUDENTS_ADD_SUCCESS, CLASS_STUDENTS_ADD_FAIL,
  CLASS_STUDENT_REMOVE, CLASS_STUDENT_REMOVE_SUCCESS, CLASS_STUDENT_REMOVE_FAIL,
  CLASS_COPY_ONE, CLASS_COPY_ONE_SUCCESS, CLASS_COPY_ONE_FAIL,
  CLASS_COPY_MANY, CLASS_COPY_MANY_SUCCESS, CLASS_COPY_MANY_FAIL,
  CLASS_IMPORT, CLASS_IMPORT_SUCCESS, CLASS_IMPORT_FAIL, CLASS_IMPORT_CLEAR,
  CLASS_EXPORT_ONE, CLASS_EXPORT_ONE_SUCCESS, CLASS_EXPORT_ONE_FAIL,
  CLASS_EXPORT_MANY, CLASS_EXPORT_MANY_SUCCESS, CLASS_EXPORT_MANY_FAIL,
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
  massDeleteLoading: false,
  classStudents: [],
  classStudentsPageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
  classStudentsLoading: false,
  classStudentsError: null,
  availableStudents: [],
  availableStudentsPageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
  availableStudentsLoading: false,
  availableStudentsError: null,
  selectedAvailableStudentIds: [],
  selectedAvailableStudentsById: {},
  addStudentsLoading: false,
  addStudentsError: null,
  removingStudentId: null,
  removeStudentError: null,
  copyingClassId: null,
  copyManyLoading: false,
  copyResult: null,
  copyError: null,
  importLoading: false,
  importResult: null,
  importError: null,
  exportingClassId: null,
  exportManyLoading: false,
  exportError: null,
  error: null,
}

const normalizeSelectedId = value => {
  if (value === null || value === undefined) return null
  const key = String(value)
  if (/^[1-9]\d*$/.test(key)) {
    const id = Number(key)
    return Number.isSafeInteger(id) ? key : null
  }
  return null
}

const normalizeSelectedIds = ids => Array.from(new Set((Array.isArray(ids) ? ids : [])
  .map(normalizeSelectedId)
  .filter(id => id !== null)))

const selectedRecordsForIds = (ids, recordsById) => ids.reduce((result, id) => {
  const record = recordsById?.[id]
  if (record) result[id] = record
  return result
}, {})

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

    case CLASS_MASS_DELETE:
      return { ...state, massDeleteLoading: true, error: null }
    case CLASS_MASS_DELETE_SUCCESS:
      return { ...state, massDeleteLoading: false }
    case CLASS_MASS_DELETE_FAIL:
      return { ...state, massDeleteLoading: false, error: action.message }

    case CLASS_STUDENTS_FETCH:
      return { ...state, classStudentsLoading: true, classStudentsError: null }
    case CLASS_STUDENTS_FETCH_SUCCESS:
      return {
        ...state,
        classStudentsLoading: false,
        classStudents: Array.isArray(action.data?.records) ? action.data.records : [],
        classStudentsPageInfo: action.data?.page_info || initialState.classStudentsPageInfo,
      }
    case CLASS_STUDENTS_FETCH_FAIL:
      return { ...state, classStudentsLoading: false, classStudentsError: action.message }
    case CLASS_STUDENTS_CLEAR:
      return {
        ...state,
        classStudents: [],
        classStudentsPageInfo: initialState.classStudentsPageInfo,
        classStudentsLoading: false,
        classStudentsError: null,
        removingStudentId: null,
        removeStudentError: null,
      }

    case CLASS_AVAILABLE_STUDENTS_FETCH:
      return { ...state, availableStudentsLoading: true, availableStudentsError: null }
    case CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS:
      return {
        ...state,
        availableStudentsLoading: false,
        availableStudents: Array.isArray(action.data?.records) ? action.data.records : [],
        availableStudentsPageInfo: action.data?.page_info || initialState.availableStudentsPageInfo,
      }
    case CLASS_AVAILABLE_STUDENTS_FETCH_FAIL:
      return { ...state, availableStudentsLoading: false, availableStudentsError: action.message }
    case CLASS_AVAILABLE_STUDENTS_SELECTION_SET: {
      const ids = normalizeSelectedIds(action.ids)
      const recordsById = action.recordsById && typeof action.recordsById === 'object'
        ? action.recordsById
        : state.selectedAvailableStudentsById
      return {
        ...state,
        selectedAvailableStudentIds: ids,
        selectedAvailableStudentsById: selectedRecordsForIds(ids, recordsById),
      }
    }
    case CLASS_AVAILABLE_STUDENTS_CLEAR:
      return {
        ...state,
        availableStudents: [],
        availableStudentsPageInfo: initialState.availableStudentsPageInfo,
        availableStudentsLoading: false,
        availableStudentsError: null,
        selectedAvailableStudentIds: [],
        selectedAvailableStudentsById: {},
      }

    case CLASS_STUDENTS_ADD:
      return { ...state, addStudentsLoading: true, addStudentsError: null }
    case CLASS_STUDENTS_ADD_SUCCESS:
      return { ...state, addStudentsLoading: false }
    case CLASS_STUDENTS_ADD_FAIL:
      return { ...state, addStudentsLoading: false, addStudentsError: action.message }

    case CLASS_STUDENT_REMOVE:
      return { ...state, removingStudentId: action.studentId, removeStudentError: null }
    case CLASS_STUDENT_REMOVE_SUCCESS:
      return { ...state, removingStudentId: null }
    case CLASS_STUDENT_REMOVE_FAIL:
      return { ...state, removingStudentId: null, removeStudentError: action.message }

    case CLASS_COPY_ONE:
      return { ...state, copyingClassId: action.id, copyError: null }
    case CLASS_COPY_ONE_SUCCESS:
      return { ...state, copyingClassId: null, copyResult: action.data }
    case CLASS_COPY_ONE_FAIL:
      return { ...state, copyingClassId: null, copyError: action.message }
    case CLASS_COPY_MANY:
      return { ...state, copyManyLoading: true, copyError: null }
    case CLASS_COPY_MANY_SUCCESS:
      return { ...state, copyManyLoading: false, copyResult: action.data }
    case CLASS_COPY_MANY_FAIL:
      return { ...state, copyManyLoading: false, copyError: action.message }

    case CLASS_IMPORT:
      return { ...state, importLoading: true, importResult: null, importError: null }
    case CLASS_IMPORT_SUCCESS:
      return { ...state, importLoading: false, importResult: action.data, importError: null }
    case CLASS_IMPORT_FAIL:
      return { ...state, importLoading: false, importError: action.message }
    case CLASS_IMPORT_CLEAR:
      return { ...state, importLoading: false, importResult: null, importError: null }

    case CLASS_EXPORT_ONE:
      return { ...state, exportingClassId: action.id, exportError: null }
    case CLASS_EXPORT_ONE_SUCCESS:
      return { ...state, exportingClassId: null }
    case CLASS_EXPORT_ONE_FAIL:
      return { ...state, exportingClassId: null, exportError: action.message }
    case CLASS_EXPORT_MANY:
      return { ...state, exportManyLoading: true, exportError: null }
    case CLASS_EXPORT_MANY_SUCCESS:
      return { ...state, exportManyLoading: false }
    case CLASS_EXPORT_MANY_FAIL:
      return { ...state, exportManyLoading: false, exportError: action.message }

    default:
      return state
  }
}

export default classroom
