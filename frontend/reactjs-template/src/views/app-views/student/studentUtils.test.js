import {
  buildDisplayedStudentRecords, buildStudentOrder, formatStudentDate, formatStudentSex,
  getPageScopedSelectionChange, getSafeHttpUrl, getStudentRowKey, getStudentSortOrder,
  normalizeStudentRowKeys, toStudentApiIds
} from './studentUtils'

describe('student sorting', () => {
  test('maps student columns to backend order aliases', () => {
    expect(buildStudentOrder([
      { columnKey: 'fullname', order: 'ascend' },
      { columnKey: 'code', order: 'descend' },
    ])).toBe('fn:0-co:1')
    expect(getStudentSortOrder('fn:0-co:1', 'fullname')).toBe('ascend')
    expect(getStudentSortOrder('fn:0-co:1', 'code')).toBe('descend')
  })

  test('drops unsupported columns and cleared sort values', () => {
    expect(buildStudentOrder([
      { columnKey: 'email', order: 'ascend' },
      { columnKey: 'code', order: undefined },
    ])).toBe('')
  })
})

describe('student shared helpers', () => {
  test('formats backend date and sex values consistently', () => {
    expect(formatStudentDate('2004-01-15T00:00:00.000Z')).toBe('15/01/2004')
    expect(formatStudentDate('invalid')).toBe('-')
    expect(formatStudentSex(false)).toBe('Nữ')
    expect(formatStudentSex('true')).toBe('Nam')
  })

  test('accepts only safe HTTP image and link URLs', () => {
    expect(getSafeHttpUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(getSafeHttpUrl('javascript:alert(1)')).toBeNull()
  })

  test('pins selected records without duplicating current-page records', () => {
    const selectedRecordsById = {
      1: { id: 1, fullname: 'Trang trước' },
      2: { id: 2, fullname: 'Trang hiện tại' },
    }
    expect(buildDisplayedStudentRecords(
      [{ id: 2 }, { id: 3 }],
      [1, 2],
      selectedRecordsById
    ).map(record => record.id)).toEqual([1, 2, 3])
  })

  test('uses an explicit string row-key function for number and string API IDs', () => {
    const selectedRecordsById = {
      1: { id: 1, fullname: 'ID number' },
      2: { id: '2', fullname: 'ID string' },
    }
    const records = buildDisplayedStudentRecords(
      [{ id: 1 }, { id: '2' }, { id: 3 }],
      ['1', '2'],
      selectedRecordsById,
      record => String(record.id)
    )
    expect(records.map(record => String(record.id))).toEqual(['1', '2', '3'])
  })

  test('normalizes student row keys independently from API integer IDs', () => {
    expect(getStudentRowKey({ id: 12 })).toBe('12')
    expect(getStudentRowKey({ id: '12' })).toBe('12')
    expect(getStudentRowKey(12)).toBe('12')
    expect(getStudentRowKey('12')).toBe('12')
    expect(getStudentRowKey({})).toBe('')
    expect(normalizeStudentRowKeys([1, '1', 2, '2', null, '', 'invalid'])).toEqual(['1', '2'])
    expect(toStudentApiIds(['1', 2, 'invalid', null, '2'])).toEqual([1, 2])
  })

  test('keeps string-ID rows visible after one or all rows are selected', () => {
    const apiRecords = [{ id: '1', fullname: 'A' }, { id: '2', fullname: 'B' }]
    const selectedRecordsById = { '1': apiRecords[0], '2': apiRecords[1] }
    expect(buildDisplayedStudentRecords(
      apiRecords,
      ['1'],
      selectedRecordsById,
      getStudentRowKey
    ).map(record => record.fullname)).toEqual(['A', 'B'])
    expect(buildDisplayedStudentRecords(
      apiRecords,
      ['1', '2'],
      selectedRecordsById,
      getStudentRowKey
    )).toHaveLength(2)
  })

  test('select-all changes only records in the current API page', () => {
    expect(getPageScopedSelectionChange({
      apiRecords: [{ id: 2 }, { id: 3 }],
      changeRows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      selected: false,
      selectedRowKeys: [1, 2, 3],
    }).keys).toEqual([1])
  })

  test('select-all can use string database keys without affecting pinned records', () => {
    expect(getPageScopedSelectionChange({
      apiRecords: [{ id: 2 }, { id: '3' }],
      changeRows: [{ id: 1 }, { id: 2 }, { id: '3' }],
      selected: false,
      selectedRowKeys: ['1', '2', '3'],
      getRecordKey: record => String(record.id),
    }).keys).toEqual(['1'])
  })

  test('keeps other-page string selections when selecting and deselecting the current page', () => {
    const pageOneKey = getStudentRowKey({ id: '1' })
    const pageTwo = [{ id: '2' }, { id: '3' }]
    const selected = getPageScopedSelectionChange({
      apiRecords: pageTwo,
      changeRows: pageTwo,
      selected: true,
      selectedRowKeys: [pageOneKey],
      getRecordKey: getStudentRowKey,
    })
    expect(selected.keys).toEqual(['1', '2', '3'])
    expect(getPageScopedSelectionChange({
      apiRecords: pageTwo,
      changeRows: pageTwo,
      selected: false,
      selectedRowKeys: selected.keys,
      getRecordKey: getStudentRowKey,
    }).keys).toEqual(['1'])
  })
})
