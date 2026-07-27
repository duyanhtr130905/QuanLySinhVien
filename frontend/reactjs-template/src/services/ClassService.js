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

ClassService.getById = async function (id) {
  const response = await ClassService.getAll({
    columnlist: 'id,code,name,description,created_at,updated_at',
  })
  const records = Array.isArray(response?.data) ? response.data : []
  const record = records.find(item => Number(item.id) === Number(id))
  if (record) return { ...response, data: record }

  const error = new Error('Không tìm thấy bản ghi lớp học')
  error.response = {
    status: 404,
    data: { code: 'F604', message: error.message },
  }
  throw error
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

export default ClassService
