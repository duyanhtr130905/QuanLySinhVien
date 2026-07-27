export const COPY_RESULT_STORAGE_KEY = 'student-copy-result'
export const COPIED_STUDENT_IDS_STORAGE_KEY = 'student-copied-ids'

const asArray = value => Array.isArray(value) ? value : []

const safeStudent = student => {
  if (!student || typeof student !== 'object') return null
  const safe = { ...student }
  delete safe.password
  delete safe.deleted_at
  return safe
}

const extractIdsFromMessage = message => {
  if (typeof message !== 'string') return []
  const match = message.match(/ids:\s*([0-9,\s]+)/i)
  return match
    ? match[1].split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0)
    : []
}

export const unwrapCopiedStudent = response => {
  const payload = response?.data || response
  const created = payload?.created || payload
  return safeStudent(created)
}

export const normalizeMassCopyResponse = response => {
  const payload = response?.data || response
  const createdSource = Array.isArray(payload) ? payload : payload?.created
  const created = asArray(createdSource).map(safeStudent).filter(Boolean)
  const notFoundSource = Array.isArray(payload?.notFound)
    ? payload.notFound
    : extractIdsFromMessage(response?.message || payload?.message)
  const notFound = asArray(notFoundSource)
    .map(item => Number(item && typeof item === 'object' ? item.id : item))
    .filter(id => Number.isSafeInteger(id) && id > 0)
  return { created, notFound }
}

export const getCopyErrorMessage = error => {
  const payload = error?.response?.data || error?.data || error
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return 'Không thể sao chép sinh viên. Vui lòng thử lại.'
}

export const saveCopyResultSession = result => {
  try {
    const createdIds = asArray(result?.created)
      .map(student => Number(student?.id))
      .filter(id => Number.isSafeInteger(id) && id > 0)
    sessionStorage.setItem(COPY_RESULT_STORAGE_KEY, JSON.stringify({
      createdIds,
      notFound: asArray(result?.notFound),
    }))
  } catch (error) {
    // The result page can still use location state when storage is unavailable.
  }
}

export const readCopyResultSession = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(COPY_RESULT_STORAGE_KEY) || 'null')
    if (!parsed || !Array.isArray(parsed.createdIds)) return null
    return {
      createdIds: parsed.createdIds
        .map(Number)
        .filter(id => Number.isSafeInteger(id) && id > 0),
      notFound: asArray(parsed.notFound)
        .map(Number)
        .filter(id => Number.isSafeInteger(id) && id > 0),
    }
  } catch (error) {
    return null
  }
}

const readRememberedCopiedIds = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(COPIED_STUDENT_IDS_STORAGE_KEY) || '[]')
    return asArray(parsed)
      .map(Number)
      .filter(id => Number.isSafeInteger(id) && id > 0)
  } catch (error) {
    return []
  }
}

export const rememberCopiedStudentId = id => {
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return
  try {
    const ids = [...new Set([...readRememberedCopiedIds(), numericId])].slice(-200)
    sessionStorage.setItem(COPIED_STUDENT_IDS_STORAGE_KEY, JSON.stringify(ids))
  } catch (error) {
    // Navigation state remains available when session storage is unavailable.
  }
}

export const hasStoredCopyReference = id => {
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return false
  if (readRememberedCopiedIds().includes(numericId)) return true
  return Boolean(readCopyResultSession()?.createdIds.includes(numericId))
}
