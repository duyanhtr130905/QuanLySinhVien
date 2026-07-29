import { all, call, put, takeEvery, takeLatest } from 'redux-saga/effects'
import {
  CLASS_LIST_FETCH, CLASS_DETAIL_FETCH, CLASS_DETAIL_CLEAR, CLASS_CREATE, CLASS_UPDATE, CLASS_DELETE,
  CLASS_MASS_DELETE, CLASS_STUDENTS_FETCH, CLASS_STUDENTS_CLEAR,
  CLASS_AVAILABLE_STUDENTS_FETCH, CLASS_AVAILABLE_STUDENTS_CLEAR,
  CLASS_STUDENTS_ADD, CLASS_STUDENT_REMOVE,
  CLASS_COPY_ONE, CLASS_COPY_MANY, CLASS_IMPORT,
  CLASS_EXPORT_ONE, CLASS_EXPORT_MANY,
} from '../constants/Class'
import {
  fetchClassListSuccess, fetchClassListFail,
  fetchClassDetailSuccess, fetchClassDetailFail,
  createClassSuccess, createClassFail,
  updateClassSuccess, updateClassFail,
  deleteClassSuccess, deleteClassFail,
  massDeleteClassSuccess, massDeleteClassFail,
  fetchClassStudentsSuccess, fetchClassStudentsFail,
  fetchAvailableStudentsSuccess, fetchAvailableStudentsFail,
  addStudentsToClassSuccess, addStudentsToClassFail,
  removeStudentFromClassSuccess, removeStudentFromClassFail,
  copyClassSuccess, copyClassFail, copyManyClassesSuccess, copyManyClassesFail,
  importClassesSuccess, importClassesFail,
  exportClassSuccess, exportClassFail, exportManyClassesSuccess, exportManyClassesFail,
} from '../actions/Class'
import ClassService from 'services/ClassService'
import downloadBlob, { getBlobErrorMessage, getDownloadFilename } from 'utils/downloadBlob'

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
  yield takeLatest([CLASS_DETAIL_FETCH, CLASS_DETAIL_CLEAR], function* ({ id, type }) {
    if (type === CLASS_DETAIL_CLEAR) return
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

export function* massDeleteClassSaga() {
  yield takeEvery(CLASS_MASS_DELETE, function* ({ ids, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.massDestroy, ids)
      yield put(massDeleteClassSuccess(response.data))
      if (onSuccess) onSuccess(response.data)
    } catch (error) {
      const payload = getErrorPayload(error)
      if (onError) onError(payload)
      yield put(massDeleteClassFail(payload?.message || 'Không thể xóa các lớp đã chọn'))
    }
  })
}

export function* fetchClassStudentsSaga() {
  yield takeLatest([CLASS_STUDENTS_FETCH, CLASS_STUDENTS_CLEAR], function* ({ id, params, type }) {
    if (type === CLASS_STUDENTS_CLEAR) return
    try {
      const response = yield call(ClassService.getClassStudents, id, params)
      yield put(fetchClassStudentsSuccess(response.data))
    } catch (error) {
      const payload = getErrorPayload(error)
      yield put(fetchClassStudentsFail(payload?.message || 'Không thể tải danh sách sinh viên trong lớp'))
    }
  })
}

export function* fetchAvailableStudentsSaga() {
  yield takeLatest([
    CLASS_AVAILABLE_STUDENTS_FETCH,
    CLASS_AVAILABLE_STUDENTS_CLEAR,
  ], function* ({ id, params, type }) {
    if (type === CLASS_AVAILABLE_STUDENTS_CLEAR) return
    try {
      const response = yield call(ClassService.getAvailableStudents, id, params)
      yield put(fetchAvailableStudentsSuccess(response.data))
    } catch (error) {
      const payload = getErrorPayload(error)
      yield put(fetchAvailableStudentsFail(payload?.message || 'Không thể tải danh sách sinh viên có thể thêm'))
    }
  })
}

export function* addStudentsToClassSaga() {
  yield takeEvery(CLASS_STUDENTS_ADD, function* ({ id, studentIds, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.addStudentsToClass, id, studentIds)
      yield put(addStudentsToClassSuccess(response.data))
      if (onSuccess) onSuccess(response.data)
    } catch (error) {
      const payload = getErrorPayload(error)
      if (onError) onError(payload)
      yield put(addStudentsToClassFail(payload?.message || 'Không thể thêm sinh viên vào lớp'))
    }
  })
}

export function* removeStudentFromClassSaga() {
  yield takeEvery(CLASS_STUDENT_REMOVE, function* ({ classId, studentId, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.removeStudentFromClass, classId, studentId)
      yield put(removeStudentFromClassSuccess(studentId))
      if (onSuccess) onSuccess(response.data)
    } catch (error) {
      const payload = getErrorPayload(error)
      if (onError) onError(payload)
      yield put(removeStudentFromClassFail(payload?.message || 'Không thể loại sinh viên khỏi lớp'))
    }
  })
}

export function* copyClassSaga() {
  yield takeEvery(CLASS_COPY_ONE, function* ({ id, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.copyOne, id)
      const data = response?.data || response
      yield put(copyClassSuccess(data))
      if (onSuccess) onSuccess(data)
    } catch (error) {
      const payload = getErrorPayload(error)
      const message = payload?.message || 'Không thể sao chép lớp.'
      yield put(copyClassFail(message))
      if (onError) onError(payload || { message })
    }
  })
}

export function* copyManyClassesSaga() {
  yield takeEvery(CLASS_COPY_MANY, function* ({ idlist, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.copyMany, idlist)
      const data = response?.data || response
      yield put(copyManyClassesSuccess(data))
      if (onSuccess) onSuccess(data)
    } catch (error) {
      const payload = getErrorPayload(error)
      const message = payload?.message || 'Không thể sao chép các lớp đã chọn.'
      yield put(copyManyClassesFail(message))
      if (onError) onError(payload || { message })
    }
  })
}

export function* importClassesSaga() {
  yield takeEvery(CLASS_IMPORT, function* ({ formData, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.importClasses, formData)
      const data = response?.data || response
      yield put(importClassesSuccess(data))
      if (onSuccess) onSuccess(data)
    } catch (error) {
      const payload = getErrorPayload(error)
      const message = payload?.message || 'Không thể import dữ liệu Lớp.'
      yield put(importClassesFail(message))
      if (onError) onError(payload || { message })
    }
  })
}

const getExportBlob = response => response?.data

export function* exportClassSaga() {
  yield takeEvery(CLASS_EXPORT_ONE, function* ({ id, exportType, fallbackFilename, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.exportOne, id, exportType)
      const blob = getExportBlob(response)
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('File export rỗng')
      const filename = getDownloadFilename(response?.headers?.['content-disposition'], fallbackFilename)
      yield call(downloadBlob, blob, filename)
      yield put(exportClassSuccess(id))
      if (onSuccess) onSuccess()
    } catch (error) {
      const message = yield call(getBlobErrorMessage, error, 'Không thể export Lớp. Vui lòng thử lại.')
      yield put(exportClassFail(message))
      if (onError) onError({ message })
    }
  })
}

export function* exportManyClassesSaga() {
  yield takeEvery(CLASS_EXPORT_MANY, function* ({ idlist, exportType, fallbackFilename, onSuccess, onError }) {
    try {
      const response = yield call(ClassService.exportMany, idlist, exportType)
      const blob = getExportBlob(response)
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('File export rỗng')
      const filename = getDownloadFilename(response?.headers?.['content-disposition'], fallbackFilename)
      yield call(downloadBlob, blob, filename)
      yield put(exportManyClassesSuccess())
      if (onSuccess) onSuccess()
    } catch (error) {
      const message = yield call(getBlobErrorMessage, error, 'Không thể export các Lớp đã chọn. Vui lòng thử lại.')
      yield put(exportManyClassesFail(message))
      if (onError) onError({ message })
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
    massDeleteClassSaga(),
    fetchClassStudentsSaga(),
    fetchAvailableStudentsSaga(),
    addStudentsToClassSaga(),
    removeStudentFromClassSaga(),
    copyClassSaga(),
    copyManyClassesSaga(),
    importClassesSaga(),
    exportClassSaga(),
    exportManyClassesSaga(),
  ])
}
