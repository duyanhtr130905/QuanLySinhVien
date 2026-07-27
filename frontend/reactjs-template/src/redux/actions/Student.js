import {
  STUDENT_LIST_FETCH, STUDENT_LIST_FETCH_SUCCESS, STUDENT_LIST_FETCH_FAIL,
  STUDENT_DETAIL_FETCH, STUDENT_DETAIL_FETCH_SUCCESS, STUDENT_DETAIL_FETCH_FAIL, STUDENT_DETAIL_CLEAR,
  STUDENT_CREATE, STUDENT_CREATE_SUCCESS, STUDENT_CREATE_FAIL,
  STUDENT_UPDATE, STUDENT_UPDATE_SUCCESS, STUDENT_UPDATE_FAIL,
  STUDENT_DELETE, STUDENT_DELETE_SUCCESS, STUDENT_DELETE_FAIL,
  STUDENT_IMPORT, STUDENT_IMPORT_SUCCESS, STUDENT_IMPORT_FAIL, STUDENT_IMPORT_CLEAR,
} from '../constants/Student'

export const fetchStudentList = (params) => ({ type: STUDENT_LIST_FETCH, params })
export const fetchStudentListSuccess = (data) => ({ type: STUDENT_LIST_FETCH_SUCCESS, data })
export const fetchStudentListFail = (message) => ({ type: STUDENT_LIST_FETCH_FAIL, message })

export const fetchStudentDetail = (id) => ({ type: STUDENT_DETAIL_FETCH, id })
export const fetchStudentDetailSuccess = (data) => ({ type: STUDENT_DETAIL_FETCH_SUCCESS, data })
export const fetchStudentDetailFail = (message, status) => ({
  type: STUDENT_DETAIL_FETCH_FAIL,
  message,
  status,
})
export const clearStudentDetail = () => ({ type: STUDENT_DETAIL_CLEAR })

export const createStudent = (formData, onSuccess, onError) => ({
  type: STUDENT_CREATE,
  formData,
  onSuccess,
  onError,
})
export const createStudentSuccess = (data) => ({ type: STUDENT_CREATE_SUCCESS, data })
export const createStudentFail = (message) => ({ type: STUDENT_CREATE_FAIL, message })

export const updateStudent = (id, formData, onSuccess, onError) => ({
  type: STUDENT_UPDATE,
  id,
  formData,
  onSuccess,
  onError,
})
export const updateStudentSuccess = (data) => ({ type: STUDENT_UPDATE_SUCCESS, data })
export const updateStudentFail = (message) => ({ type: STUDENT_UPDATE_FAIL, message })

export const deleteStudent = (id, onSuccess, onError) => ({
  type: STUDENT_DELETE,
  id,
  onSuccess,
  onError,
})
export const deleteStudentSuccess = (id) => ({ type: STUDENT_DELETE_SUCCESS, id })
export const deleteStudentFail = (message) => ({ type: STUDENT_DELETE_FAIL, message })

export const importStudents = (formData, onSuccess, onError) => ({
  type: STUDENT_IMPORT,
  formData,
  onSuccess,
  onError,
})
export const importStudentsSuccess = (data) => ({ type: STUDENT_IMPORT_SUCCESS, data })
export const importStudentsFail = (message) => ({ type: STUDENT_IMPORT_FAIL, message })
export const clearStudentImport = () => ({ type: STUDENT_IMPORT_CLEAR })
