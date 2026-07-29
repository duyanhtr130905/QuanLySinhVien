import fetch from 'auth/FetchInterceptor'

const ClassService = {}

ClassService.getByPage = function (params) {
  return fetch({
    url: '/class/page',
    method: 'get',
    params,
  })
}

ClassService.getAll = function (params) {
  return fetch({
    url: '/class/',
    method: 'get',
    params,
  })
}

ClassService.getById = function (id) {
  return fetch({
    url: `/class/${id}`,
    method: 'get',
  })
}

ClassService.create = function (data) {
  return fetch({
    url: '/class/',
    method: 'post',
    data,
  })
}

ClassService.update = function (id, data) {
  return fetch({
    url: `/class/${id}`,
    method: 'put',
    data,
  })
}

ClassService.destroy = function (id) {
  return fetch({
    url: `/class/${id}`,
    method: 'delete',
  })
}

ClassService.massDestroy = function (ids) {
  return fetch({
    url: '/class/delete',
    method: 'delete',
    data: { ids },
  })
}

ClassService.copyOne = function (id) {
  return fetch({
    url: `/class/copy/${id}`,
    method: 'post',
  })
}

ClassService.massCopy = function (idlist) {
  return fetch({
    url: '/class/copy',
    method: 'post',
    data: { idlist },
  })
}

ClassService.copyPreview = function (idlist) {
  return fetch({
    url: '/class/copy/preview',
    method: 'post',
    data: { idlist },
  })
}

ClassService.commitCopyDrafts = function (drafts) {
  return fetch({
    url: '/class/copy/commit',
    method: 'post',
    data: { drafts },
  })
}

// Kept as an alias for older Class screens while new flows use the explicit name.
ClassService.copyMany = ClassService.massCopy

ClassService.importClasses = function (formData) {
  return fetch({
    url: '/class/import',
    method: 'post',
    data: formData,
  })
}

ClassService.exportOne = function (id, type) {
  return fetch({
    url: `/class/export/${id}`,
    method: 'get',
    params: { type },
    responseType: 'blob',
    returnFullResponse: true,
  })
}

ClassService.exportMany = function (idlist, type) {
  return fetch({
    url: '/class/export',
    method: 'post',
    data: { idlist, type },
    responseType: 'blob',
    returnFullResponse: true,
  })
}

ClassService.getClassStudents = function (id, params) {
  return fetch({
    url: `/class/${id}/students`,
    method: 'get',
    params,
  })
}

ClassService.getAvailableStudents = function (id, params) {
  return fetch({
    url: `/class/${id}/available-students`,
    method: 'get',
    params,
  })
}

ClassService.addStudentsToClass = function (id, studentIds) {
  return fetch({
    url: `/class/${id}/students`,
    method: 'post',
    data: { studentIds },
  })
}

ClassService.removeStudentFromClass = function (classId, studentId) {
  return fetch({
    url: `/class/${classId}/students/${studentId}`,
    method: 'delete',
  })
}

ClassService.removeStudentsFromClass = function (classId, studentIds) {
  return fetch({
    url: `/class/${classId}/students/remove`,
    method: 'patch',
    data: { studentIds },
  })
}

export default ClassService
