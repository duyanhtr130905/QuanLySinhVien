import fetch from 'auth/FetchInterceptor'

const HobbyService = {}

HobbyService.getAll = function () {
  return fetch({
    url: '/hobby/',
    method: 'get'
  })
}

HobbyService.create = function (name) {
  return fetch({
    url: '/hobby/',
    method: 'post',
    data: { name }
  })
}

HobbyService.destroy = function (id) {
  return fetch({
    url: `/hobby/${id}`,
    method: 'delete',
  })
}

export default HobbyService
