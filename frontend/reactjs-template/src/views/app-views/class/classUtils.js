export const CLASS_COPY_RESULT_STORAGE_KEY = 'class-copy-result'
export const COPIED_CLASS_IDS_STORAGE_KEY = 'class-copied-ids'

export const CLASS_ORDER_ALIASES = {
  id: 'id',
  code: 'co',
  name: 'na',
  description: 'de',
  created_at: 'ca',
  updated_at: 'ua',
}

const asArray = value => Array.isArray(value) ? value : []

export const trimClassSearch = value => (
  typeof value === 'string' ? value.trim() : ''
)

export const buildClassOrder = sorter => {
  const sorters = Array.isArray(sorter) ? sorter : [sorter]
  return sorters
    .filter(item => item?.order && CLASS_ORDER_ALIASES[item.columnKey || item.field])
    .map(item => (
      `${CLASS_ORDER_ALIASES[item.columnKey || item.field]}:${item.order === 'descend' ? 1 : 0}`
    ))
    .join('-')
}

const normalizeIdList = value => asArray(value)
  .map(item => Number(item && typeof item === 'object' ? item.id : item))
  .filter(id => Number.isSafeInteger(id) && id > 0)

export const extractIdsFromMessage = message => {
  if (typeof message !== 'string') return []
  const match = message.match(/ids:\s*([0-9,\s]+)/i)
  return match ? normalizeIdList(match[1].split(',')) : []
}

export const normalizeMassDeleteResponse = response => {
  const payload = response?.data || response || {}
  return {
    deletedIds: normalizeIdList(payload.deletedIds || payload.ids),
    blockedIds: normalizeIdList(
      payload.blockedIds || extractIdsFromMessage(response?.message || payload.message)
    ),
  }
}

export const normalizeClassCopyResponse = response => {
  const payload = response?.data || response
  return payload && typeof payload === 'object' ? payload : null
}

export const normalizeMassClassCopyResponse = response => {
  const payload = response?.data || response
  const created = asArray(Array.isArray(payload) ? payload : payload?.created)
    .filter(item => item && typeof item === 'object')
  const notFound = normalizeIdList(
    payload?.notFound || extractIdsFromMessage(response?.message || payload?.message)
  )
  return { created, notFound }
}

export const normalizeClassFormValues = values => ({
  code: typeof values?.code === 'string' ? values.code.trim() : '',
  name: typeof values?.name === 'string' ? values.name.trim() : '',
  description: typeof values?.description === 'string'
    ? values.description.trim()
    : '',
})

export const validateClassValues = values => {
  const normalized = normalizeClassFormValues(values)
  const errors = {}
  if (!normalized.code) errors.code = 'Vui lòng nhập mã lớp'
  else if (normalized.code.length > 50) errors.code = 'Mã lớp không được vượt quá 50 ký tự'
  if (!normalized.name) errors.name = 'Vui lòng nhập tên lớp'
  else if (normalized.name.length > 255) errors.name = 'Tên lớp không được vượt quá 255 ký tự'
  return errors
}

export const getChangedClassFields = (initialValues, nextValues) => {
  const initial = normalizeClassFormValues(initialValues)
  const next = normalizeClassFormValues(nextValues)
  const changed = {}
  if (next.name !== initial.name) changed.name = next.name
  if (next.description !== initial.description) changed.description = next.description
  return changed
}

const safeSessionGet = key => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null')
  } catch (error) {
    return null
  }
}

export const saveClassCopyResult = result => {
  try {
    sessionStorage.setItem(CLASS_COPY_RESULT_STORAGE_KEY, JSON.stringify({
      createdIds: normalizeIdList(result?.created),
      notFound: normalizeIdList(result?.notFound),
    }))
  } catch (error) {
    // Navigation state remains the primary source when storage is unavailable.
  }
}

export const readClassCopyResult = () => {
  const stored = safeSessionGet(CLASS_COPY_RESULT_STORAGE_KEY)
  if (!stored || !Array.isArray(stored.createdIds)) return null
  return {
    createdIds: normalizeIdList(stored.createdIds),
    notFound: normalizeIdList(stored.notFound),
  }
}

export const rememberCopiedClassId = id => {
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return
  try {
    const current = normalizeIdList(safeSessionGet(COPIED_CLASS_IDS_STORAGE_KEY))
    sessionStorage.setItem(
      COPIED_CLASS_IDS_STORAGE_KEY,
      JSON.stringify([...new Set([...current, numericId])].slice(-200))
    )
  } catch (error) {
    // Location state still identifies the newly copied record.
  }
}

export const hasCopiedClassReference = id => {
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return false
  const copiedIds = normalizeIdList(safeSessionGet(COPIED_CLASS_IDS_STORAGE_KEY))
  return copiedIds.includes(numericId) || Boolean(
    readClassCopyResult()?.createdIds.includes(numericId)
  )
}
