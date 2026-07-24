import fetch from 'auth/FetchInterceptor'

const StudentService = {}

StudentService.getByPage = function (params) {
  return fetch({
    url: '/student/page',
    method: 'get',
    params // { page, size, order, search, columnlist, toplist }
  })
}

StudentService.getById = function (id) {
  return fetch({
    url: `/student/${id}`,
    method: 'get'
  })
}

StudentService.create = function (formData) {
  return fetch({
    url: '/student',
    method: 'post',
    data: formData,
  })
}

StudentService.update = function (id, formData) {
  return fetch({
    url: `/student/${id}`,
    method: 'put',
    data: formData,
  })
}

StudentService.destroy = function (id) {
  return fetch({
    url: `/student/${id}`,
    method: 'delete'
  })
}

StudentService.massDestroy = function (idlist) {
  return fetch({
    url: '/student',
    method: 'delete',
    data: { idlist }
  })
}

StudentService.massCopy = function (idlist) {
  return fetch({
    url: '/student/copy',
    method: 'post',
    data: { idlist }
  })
}

StudentService.massExport = function (idlist, type) {
  return fetch({
    url: '/student/export',
    method: 'post',
    data: { idlist, type },
    responseType: 'blob'
  })
}

StudentService.copyOne = function (id) {
  return fetch({
    url: `/student/copy/${id}`,
    method: 'post'
  })
}

export default StudentService
