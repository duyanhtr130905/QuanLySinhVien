import { all, call, put, takeEvery, takeLatest } from 'redux-saga/effects'
import {
  CLASS_LIST_FETCH, CLASS_DETAIL_FETCH, CLASS_CREATE, CLASS_UPDATE, CLASS_DELETE,
} from '../constants/Class'
import {
  fetchClassListSuccess, fetchClassListFail,
  fetchClassDetailSuccess, fetchClassDetailFail,
  createClassSuccess, createClassFail,
  updateClassSuccess, updateClassFail,
  deleteClassSuccess, deleteClassFail,
} from '../actions/Class'
import ClassService from 'services/ClassService'

const getErrorPayload = error => error?.response?.data || error

export function* fetchClassListSaga() {
  yield takeLatest(CLASS_LIST_FETCH, function* ({ params }) {
    try {
      const response = yield call(ClassService.getByPage, params)
      yield put(fetchClassListSuccess(response.data))
    } catch (error) {
      yield put(fetchClassListFail(
        getErrorPayload(error)?.message || 'Không thể tải danh sách lớp'
      ))
    }
  })
}

export function* fetchClassDetailSaga() {
  yield takeLatest(CLASS_DETAIL_FETCH, function* ({ id }) {
    try {
      const response = yield call(ClassService.getById, id)
      yield put(fetchClassDetailSuccess(response.data))
    } catch (error) {
      const payload = getErrorPayload(error)
      yield put(fetchClassDetailFail(
        payload?.message || 'Không thể tải dữ liệu lớp',
        error?.response?.status
      ))
    }
  })
}

export function* createClassSaga() {
  yield takeEvery(CLASS_CREATE, function* ({ data, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.create, data)
      yield put(createClassSuccess(response.data))
      if (onSuccess) onSuccess(response.data)
    } catch (error) {
      const payload = getErrorPayload(error)
      if (onError) onError(payload)
      yield put(createClassFail(payload?.message || 'Không thể thêm mới lớp'))
    }
  })
}

export function* updateClassSaga() {
  yield takeEvery(CLASS_UPDATE, function* ({ id, data, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.update, id, data)
      yield put(updateClassSuccess(response.data))
      if (onSuccess) onSuccess(response.data)
    } catch (error) {
      const payload = getErrorPayload(error)
      if (onError) onError(payload)
      yield put(updateClassFail(payload?.message || 'Không thể cập nhật lớp'))
    }
  })
}

export function* deleteClassSaga() {
  yield takeEvery(CLASS_DELETE, function* ({ id, onSuccess, onError }) {
    try {
      yield call(ClassService.destroy, id)
      yield put(deleteClassSuccess(id))
      if (onSuccess) onSuccess()
    } catch (error) {
      const payload = getErrorPayload(error)
      if (onError) onError(payload, error?.response?.status)
      yield put(deleteClassFail(payload?.message || 'Không thể xóa lớp'))
    }
  })
}

export default function* rootClassSaga() {
  yield all([
    fetchClassListSaga(),
    fetchClassDetailSaga(),
    createClassSaga(),
    updateClassSaga(),
    deleteClassSaga(),
  ])
}
