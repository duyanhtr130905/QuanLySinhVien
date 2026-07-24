import {
  STUDENT_LIST_FETCH, STUDENT_LIST_FETCH_SUCCESS, STUDENT_LIST_FETCH_FAIL,
  STUDENT_DETAIL_FETCH, STUDENT_DETAIL_FETCH_SUCCESS, STUDENT_DETAIL_FETCH_FAIL, STUDENT_DETAIL_CLEAR,
  STUDENT_CREATE, STUDENT_CREATE_SUCCESS, STUDENT_CREATE_FAIL,
  STUDENT_UPDATE, STUDENT_UPDATE_SUCCESS, STUDENT_UPDATE_FAIL,
  STUDENT_DELETE, STUDENT_DELETE_SUCCESS, STUDENT_DELETE_FAIL,
} from '../constants/Student'

export const fetchStudentList = (params) => ({ type: STUDENT_LIST_FETCH, params })
export const fetchStudentListSuccess = (data) => ({ type: STUDENT_LIST_FETCH_SUCCESS, data })
export const fetchStudentListFail = (message) => ({ type: STUDENT_LIST_FETCH_FAIL, message })

export const fetchStudentDetail = (id) => ({ type: STUDENT_DETAIL_FETCH, id })
export const fetchStudentDetailSuccess = (data) => ({ type: STUDENT_DETAIL_FETCH_SUCCESS, data })
export const fetchStudentDetailFail = (message) => ({ type: STUDENT_DETAIL_FETCH_FAIL, message })
export const clearStudentDetail = () => ({ type: STUDENT_DETAIL_CLEAR })

export const createStudent = (formData, onSuccess) => ({ type: STUDENT_CREATE, formData, onSuccess })
export const createStudentSuccess = (data) => ({ type: STUDENT_CREATE_SUCCESS, data })
export const createStudentFail = (message) => ({ type: STUDENT_CREATE_FAIL, message })

export const updateStudent = (id, formData, onSuccess) => ({ type: STUDENT_UPDATE, id, formData, onSuccess })
export const updateStudentSuccess = (data) => ({ type: STUDENT_UPDATE_SUCCESS, data })
export const updateStudentFail = (message) => ({ type: STUDENT_UPDATE_FAIL, message })

export const deleteStudent = (id, onSuccess) => ({ type: STUDENT_DELETE, id, onSuccess })
export const deleteStudentSuccess = (id) => ({ type: STUDENT_DELETE_SUCCESS, id })
export const deleteStudentFail = (message) => ({ type: STUDENT_DELETE_FAIL, message })
