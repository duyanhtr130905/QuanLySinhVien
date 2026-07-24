import { all, takeEvery, put, call } from 'redux-saga/effects'
import {
  STUDENT_LIST_FETCH, STUDENT_DETAIL_FETCH, STUDENT_CREATE, STUDENT_UPDATE, STUDENT_DELETE,
} from '../constants/Student'
import {
  fetchStudentListSuccess, fetchStudentListFail,
  fetchStudentDetailSuccess, fetchStudentDetailFail,
  createStudentSuccess, createStudentFail,
  updateStudentSuccess, updateStudentFail,
  deleteStudentSuccess, deleteStudentFail,
} from '../actions/Student'
import StudentService from 'services/StudentService'

export function* fetchList() {
  yield takeEvery(STUDENT_LIST_FETCH, function* ({ params }) {
    try {
      const response = yield call(StudentService.getByPage, params)
      yield put(fetchStudentListSuccess(response.data))
    } catch (err) {
      yield put(fetchStudentListFail(err.response?.data?.message || 'Lỗi tải danh sách sinh viên'))
    }
  })
}

export function* fetchDetail() {
  yield takeEvery(STUDENT_DETAIL_FETCH, function* ({ id }) {
    try {
      const response = yield call(StudentService.getById, id)
      yield put(fetchStudentDetailSuccess(response.data))
    } catch (err) {
      yield put(fetchStudentDetailFail(err.response?.data?.message || 'Lỗi tải chi tiết sinh viên'))
    }
  })
}

export function* createStudentSaga() {
  yield takeEvery(STUDENT_CREATE, function* ({ formData, onSuccess }) {
    try {
      const response = yield call(StudentService.create, formData)
      yield put(createStudentSuccess(response.data))
      if (onSuccess) onSuccess(response.data)
    } catch (err) {
      yield put(createStudentFail(err.response?.data?.message || 'Lỗi tạo sinh viên'))
    }
  })
}

export function* updateStudentSaga() {
  yield takeEvery(STUDENT_UPDATE, function* ({ id, formData, onSuccess }) {
    try {
      const response = yield call(StudentService.update, id, formData)
      yield put(updateStudentSuccess(response.data))
      if (onSuccess) onSuccess(response.data)
    } catch (err) {
      yield put(updateStudentFail(err.response?.data?.message || 'Lỗi cập nhật sinh viên'))
    }
  })
}

export function* deleteStudentSaga() {
  yield takeEvery(STUDENT_DELETE, function* ({ id, onSuccess }) {
    try {
      yield call(StudentService.destroy, id)
      yield put(deleteStudentSuccess(id))
      if (onSuccess) onSuccess()
    } catch (err) {
      yield put(deleteStudentFail(err.response?.data?.message || 'Lỗi xóa sinh viên'))
    }
  })
}

export default function* rootStudentSaga() {
  yield all([
    fetchList(), fetchDetail(), createStudentSaga(), updateStudentSaga(), deleteStudentSaga(),
  ])
}
