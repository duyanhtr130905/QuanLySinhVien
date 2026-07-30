import { isPositivePowerOfTwo } from './studentFormUtils'

export const STUDENT_CREATE_DRAFT_KEY = 'student-create-draft'
export const STUDENT_CREATE_DRAFT_VERSION = 1

const text = value => typeof value === 'string' ? value : ''

const normalizeDate = value => {
  const date = value?.format ? value.format('YYYY-MM-DD') : value
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

const normalizeClassId = value => {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const normalizeHobbies = values => (
  Array.isArray(values)
    ? [...new Set(values.map(Number).filter(isPositivePowerOfTwo))]
    : []
)

const validSavedAt = value => (
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
)

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch (error) {
    return null
  }
}

export const serializeStudentDraft = (values = {}, { hasAttachment = false } = {}) => ({
  version: STUDENT_CREATE_DRAFT_VERSION,
  savedAt: new Date().toISOString(),
  values: {
    code: text(values.code),
    fullname: text(values.fullname),
    dob: normalizeDate(values.dob),
    sex: values.sex === true || values.sex === false ? values.sex : null,
    class_id: normalizeClassId(values.class_id),
    homecity: text(values.homecity),
    address: text(values.address),
    hobbies: normalizeHobbies(values.hobbies),
    description: text(values.description),
    hair_color: text(values.hair_color),
    email: text(values.email),
    facebook: text(values.facebook),
    username: text(values.username),
  },
  hadAttachment: Boolean(hasAttachment),
})

export const deserializeStudentDraft = value => {
  let draft
  try {
    draft = typeof value === 'string' ? JSON.parse(value) : value
  } catch (error) {
    return null
  }

  if (
    !draft || typeof draft !== 'object' ||
    draft.version !== STUDENT_CREATE_DRAFT_VERSION ||
    !validSavedAt(draft.savedAt) ||
    !draft.values || typeof draft.values !== 'object' ||
    (draft.hadAttachment !== undefined && typeof draft.hadAttachment !== 'boolean')
  ) return null

  const values = draft.values
  const stringFields = [
    'code', 'fullname', 'homecity', 'address', 'description', 'hair_color',
    'email', 'facebook', 'username',
  ]
  if (stringFields.some(field => values[field] !== undefined && typeof values[field] !== 'string')) return null
  if (values.dob !== null && values.dob !== undefined && normalizeDate(values.dob) !== values.dob) return null
  if (values.sex !== null && values.sex !== undefined && typeof values.sex !== 'boolean') return null
  if (values.class_id !== null && values.class_id !== undefined && normalizeClassId(values.class_id) !== values.class_id) return null
  if (!Array.isArray(values.hobbies) || normalizeHobbies(values.hobbies).length !== values.hobbies.length) return null

  return {
    version: draft.version,
    savedAt: draft.savedAt,
    values: {
      ...serializeStudentDraft(values).values,
      dob: values.dob || null,
      sex: values.sex === undefined ? null : values.sex,
      class_id: values.class_id === undefined ? null : values.class_id,
    },
    hadAttachment: Boolean(draft.hadAttachment),
  }
}

export const saveStudentCreateDraft = (values, options) => {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.setItem(STUDENT_CREATE_DRAFT_KEY, JSON.stringify(serializeStudentDraft(values, options)))
    return true
  } catch (error) {
    return false
  }
}

export const clearStudentCreateDraft = () => {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(STUDENT_CREATE_DRAFT_KEY)
  } catch (error) {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

export const loadStudentCreateDraft = () => {
  const storage = getStorage()
  if (!storage) return null
  try {
    const rawDraft = storage.getItem(STUDENT_CREATE_DRAFT_KEY)
    if (!rawDraft) return null
    const draft = deserializeStudentDraft(rawDraft)
    if (draft) return draft
  } catch (error) {
    // Invalid JSON is treated like an expired draft.
  }
  clearStudentCreateDraft()
  return null
}
