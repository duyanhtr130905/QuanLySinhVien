import {
  CLASS_LIST_FETCH, CLASS_LIST_FETCH_SUCCESS, CLASS_LIST_FETCH_FAIL,
  CLASS_DETAIL_FETCH, CLASS_DETAIL_FETCH_SUCCESS, CLASS_DETAIL_FETCH_FAIL, CLASS_DETAIL_CLEAR,
  CLASS_CREATE, CLASS_CREATE_SUCCESS, CLASS_CREATE_FAIL,
  CLASS_UPDATE, CLASS_UPDATE_SUCCESS, CLASS_UPDATE_FAIL,
  CLASS_DELETE, CLASS_DELETE_SUCCESS, CLASS_DELETE_FAIL,
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
