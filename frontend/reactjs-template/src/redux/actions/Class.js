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

export const fetchClassList = params => ({ type: CLASS_LIST_FETCH, params })
export const fetchClassListSuccess = data => ({ type: CLASS_LIST_FETCH_SUCCESS, data })
export const fetchClassListFail = message => ({ type: CLASS_LIST_FETCH_FAIL, message })

export const fetchClassDetail = id => ({ type: CLASS_DETAIL_FETCH, id })
export const fetchClassDetailSuccess = data => ({ type: CLASS_DETAIL_FETCH_SUCCESS, data })
export const fetchClassDetailFail = (message, status) => ({
  type: CLASS_DETAIL_FETCH_FAIL,
  message,
  status,
})
export const clearClassDetail = () => ({ type: CLASS_DETAIL_CLEAR })

export const createClass = (data, onSuccess, onError) => ({
  type: CLASS_CREATE,
  data,
  onSuccess,
  onError,
})
export const createClassSuccess = data => ({ type: CLASS_CREATE_SUCCESS, data })
export const createClassFail = message => ({ type: CLASS_CREATE_FAIL, message })

export const updateClass = (id, data, onSuccess, onError) => ({
  type: CLASS_UPDATE,
  id,
  data,
  onSuccess,
  onError,
})
export const updateClassSuccess = data => ({ type: CLASS_UPDATE_SUCCESS, data })
export const updateClassFail = message => ({ type: CLASS_UPDATE_FAIL, message })

export const deleteClass = (id, onSuccess, onError) => ({
  type: CLASS_DELETE,
  id,
  onSuccess,
  onError,
})
export const deleteClassSuccess = id => ({ type: CLASS_DELETE_SUCCESS, id })
export const deleteClassFail = message => ({ type: CLASS_DELETE_FAIL, message })

export const massDeleteClass = (ids, onSuccess, onError) => ({
  type: CLASS_MASS_DELETE,
  ids,
  onSuccess,
  onError,
})
export const massDeleteClassSuccess = data => ({ type: CLASS_MASS_DELETE_SUCCESS, data })
export const massDeleteClassFail = message => ({ type: CLASS_MASS_DELETE_FAIL, message })

export const fetchClassStudents = (id, params) => ({ type: CLASS_STUDENTS_FETCH, id, params })
export const fetchClassStudentsSuccess = data => ({ type: CLASS_STUDENTS_FETCH_SUCCESS, data })
export const fetchClassStudentsFail = message => ({ type: CLASS_STUDENTS_FETCH_FAIL, message })
export const clearClassStudents = () => ({ type: CLASS_STUDENTS_CLEAR })

export const fetchAvailableStudents = (id, params) => ({
  type: CLASS_AVAILABLE_STUDENTS_FETCH,
  id,
  params,
})
export const fetchAvailableStudentsSuccess = data => ({ type: CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS, data })
export const fetchAvailableStudentsFail = message => ({ type: CLASS_AVAILABLE_STUDENTS_FETCH_FAIL, message })
export const clearAvailableStudents = () => ({ type: CLASS_AVAILABLE_STUDENTS_CLEAR })
export const setSelectedAvailableStudentIds = (ids, recordsById) => ({
  type: CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
  ids,
  recordsById,
})

export const addStudentsToClass = (id, studentIds, onSuccess, onError) => ({
  type: CLASS_STUDENTS_ADD,
  id,
  studentIds,
  onSuccess,
  onError,
})
export const addStudentsToClassSuccess = data => ({ type: CLASS_STUDENTS_ADD_SUCCESS, data })
export const addStudentsToClassFail = message => ({ type: CLASS_STUDENTS_ADD_FAIL, message })

export const removeStudentFromClass = (classId, studentId, onSuccess, onError) => ({
  type: CLASS_STUDENT_REMOVE,
  classId,
  studentId,
  onSuccess,
  onError,
})
export const removeStudentFromClassSuccess = studentId => ({ type: CLASS_STUDENT_REMOVE_SUCCESS, studentId })
export const removeStudentFromClassFail = message => ({ type: CLASS_STUDENT_REMOVE_FAIL, message })

export const copyClass = (id, onSuccess, onError) => ({
  type: CLASS_COPY_ONE,
  id,
  onSuccess,
  onError,
})
export const copyClassSuccess = data => ({ type: CLASS_COPY_ONE_SUCCESS, data })
export const copyClassFail = message => ({ type: CLASS_COPY_ONE_FAIL, message })

export const copyManyClasses = (idlist, onSuccess, onError) => ({
  type: CLASS_COPY_MANY,
  idlist,
  onSuccess,
  onError,
})
export const copyManyClassesSuccess = data => ({ type: CLASS_COPY_MANY_SUCCESS, data })
export const copyManyClassesFail = message => ({ type: CLASS_COPY_MANY_FAIL, message })

export const importClasses = (formData, onSuccess, onError) => ({
  type: CLASS_IMPORT,
  formData,
  onSuccess,
  onError,
})
export const importClassesSuccess = data => ({ type: CLASS_IMPORT_SUCCESS, data })
export const importClassesFail = message => ({ type: CLASS_IMPORT_FAIL, message })
export const clearClassImport = () => ({ type: CLASS_IMPORT_CLEAR })

export const exportClass = (id, type, fallbackFilename, onSuccess, onError) => ({
  type: CLASS_EXPORT_ONE,
  id,
  exportType: type,
  fallbackFilename,
  onSuccess,
  onError,
})
export const exportClassSuccess = id => ({ type: CLASS_EXPORT_ONE_SUCCESS, id })
export const exportClassFail = message => ({ type: CLASS_EXPORT_ONE_FAIL, message })

export const exportManyClasses = (idlist, type, fallbackFilename, onSuccess, onError) => ({
  type: CLASS_EXPORT_MANY,
  idlist,
  exportType: type,
  fallbackFilename,
  onSuccess,
  onError,
})
export const exportManyClassesSuccess = () => ({ type: CLASS_EXPORT_MANY_SUCCESS })
export const exportManyClassesFail = message => ({ type: CLASS_EXPORT_MANY_FAIL, message })
