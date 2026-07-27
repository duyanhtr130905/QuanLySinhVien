import moment from 'moment'

export const STUDENT_ORDER_ALIASES = {
  code: 'co',
  fullname: 'fn',
}

export const buildStudentOrder = sorter => {
  const sorters = Array.isArray(sorter) ? sorter : [sorter]
  return sorters
    .filter(item => item?.order && STUDENT_ORDER_ALIASES[item.columnKey || item.field])
    .map(item => (
      `${STUDENT_ORDER_ALIASES[item.columnKey || item.field]}:${item.order === 'descend' ? 1 : 0}`
    ))
    .join('-')
}

export const getStudentSortOrder = (order, key) => {
  const alias = STUDENT_ORDER_ALIASES[key]
  if (!alias || typeof order !== 'string') return null
  const match = order.split('-').find(part => part.startsWith(`${alias}:`))
  if (!match) return null
  return match.endsWith(':1') ? 'descend' : 'ascend'
}

export const unwrapCollection = response => {
  const payload = response?.data || response
  const records = payload?.records || payload?.items || payload
  return Array.isArray(records) ? records : []
}

export const normalizeStudentDate = value => {
  if (!value) return null
  if (moment.isMoment(value)) {
    return value.isValid() ? value.format('YYYY-MM-DD') : null
  }
  const matched = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return matched && moment(matched[1], 'YYYY-MM-DD', true).isValid()
    ? matched[1]
    : null
}

export const formatStudentDate = value => {
  const normalized = normalizeStudentDate(value)
  return normalized
    ? moment(normalized, 'YYYY-MM-DD', true).format('DD/MM/YYYY')
    : '-'
}

export const formatStudentDateTime = value => {
  if (!value) return '-'
  const date = moment(value)
  return date.isValid() ? date.format('DD/MM/YYYY HH:mm') : '-'
}

export const formatStudentSex = value => {
  if (value === true || value === 'true' || value === 1 || value === '1') return 'Nam'
  if (value === false || value === 'false' || value === 0 || value === '0') return 'Nữ'
  return '-'
}

export const normalizeStudentSex = value => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return null
}

export const getSafeHttpUrl = value => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch (error) {
    return null
  }
}

export const buildDisplayedStudentRecords = (
  apiRecords,
  selectedRowKeys,
  selectedRecordsById
) => {
  const records = Array.isArray(apiRecords) ? apiRecords : []
  const keys = Array.isArray(selectedRowKeys) ? selectedRowKeys : []
  const recordsById = selectedRecordsById && typeof selectedRecordsById === 'object'
    ? selectedRecordsById
    : {}
  const selectedKeySet = new Set(keys)
  const pinnedRecords = keys.map(key => recordsById[key]).filter(Boolean)
  return [
    ...pinnedRecords,
    ...records.filter(record => !selectedKeySet.has(record.id)),
  ]
}

export const getPageScopedSelectionChange = ({
  apiRecords,
  changeRows,
  selected,
  selectedRowKeys,
}) => {
  const records = Array.isArray(apiRecords) ? apiRecords : []
  const changed = Array.isArray(changeRows) ? changeRows : []
  const keys = Array.isArray(selectedRowKeys) ? selectedRowKeys : []
  const currentPageIds = new Set(records.map(record => record.id))
  const scopedChangeRows = changed.filter(record => currentPageIds.has(record.id))
  const changedIds = new Set(scopedChangeRows.map(record => record.id))
  return {
    keys: selected
      ? [...new Set([...keys, ...changedIds])]
      : keys.filter(key => !changedIds.has(key)),
    records: selected ? scopedChangeRows : [],
  }
}
