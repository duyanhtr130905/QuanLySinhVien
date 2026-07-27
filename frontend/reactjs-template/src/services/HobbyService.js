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

export default HobbyService
