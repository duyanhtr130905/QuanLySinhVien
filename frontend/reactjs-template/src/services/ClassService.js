import fetch from 'auth/FetchInterceptor'

const ClassService = {}

ClassService.getAll = function () {
  return fetch({
    url: '/class',
    method: 'get'
  })
}

export default ClassService
