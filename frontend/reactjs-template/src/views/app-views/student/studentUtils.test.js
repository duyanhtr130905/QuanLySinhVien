import {
  buildDisplayedStudentRecords, buildStudentOrder, formatStudentDate, formatStudentSex,
  buildStudentPageParams, getPageScopedSelectionChange, getSafeHttpUrl, getSelectionAdjustedPagination,
  getStudentRowKey, getStudentSortOrder, matchesStudentSearch, normalizeStudentRowKeys, toStudentApiIds
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

  test('serializes selected IDs as CSV so pagination exclusions reach the API', () => {
    expect(buildStudentPageParams(
      { page: 2, size: 10, search: 'an', order: 'fn:0' },
      ['1', 2, 'invalid']
    )).toEqual({
      page: 2,
      size: 10,
      search: 'an',
      order: 'fn:0',
      exclude_ids: '1,2',
    })
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

  test('adjusts pagination only for selected records matching the active search and clamps pages', () => {
    const selectedRecordsById = {
      1: { id: 1, fullname: 'An', email: 'an@example.com' },
      2: { id: 2, fullname: 'Bình', email: 'binh@example.com' },
    }
    expect(getSelectionAdjustedPagination({
      totalItems: 21,
      pageSize: 10,
      currentPage: 3,
      selectedRowKeys: ['1', '2'],
      selectedRecordsById,
      matchesRecord: record => matchesStudentSearch(record, 'an'),
    })).toEqual({ totalItems: 20, totalPages: 2, currentPage: 2 })
    expect(getSelectionAdjustedPagination({
      totalItems: 21,
      pageSize: 10,
      currentPage: 2,
      selectedRowKeys: [],
      selectedRecordsById,
      matchesRecord: record => matchesStudentSearch(record, 'an'),
    })).toEqual({ totalItems: 21, totalPages: 3, currentPage: 2 })
    expect(getSelectionAdjustedPagination({
      totalItems: 21,
      pageSize: 10,
      currentPage: 2,
      selectedRowKeys: ['1'],
      selectedRecordsById,
      matchesRecord: record => matchesStudentSearch(record, 'not-found'),
    })).toEqual({ totalItems: 21, totalPages: 3, currentPage: 2 })
  })

  test('does not pin a selected record outside the active search result', () => {
    const records = buildDisplayedStudentRecords(
      [{ id: 2, fullname: 'Bình' }],
      ['1'],
      { 1: { id: 1, fullname: 'An' } },
      getStudentRowKey,
      record => matchesStudentSearch(record, 'bình')
    )
    expect(records.map(record => record.id)).toEqual([2])
  })

  test('selects every record through selection-aware requests without skipping forward or backward pages', () => {
    const allRecords = Array.from({ length: 42 }, (_, index) => ({
      id: index + 1,
      fullname: `Sinh viên ${index + 1}`,
      email: `student${index + 1}@example.com`,
    }))
    const requestPage = (query, selectedRowKeys) => {
      const params = buildStudentPageParams(query, selectedRowKeys)
      const excluded = new Set(
        String(params.exclude_ids || '').split(',').filter(Boolean).map(Number)
      )
      const remaining = allRecords.filter(record => !excluded.has(record.id))
      return {
        params,
        records: remaining.slice((params.page - 1) * params.size, params.page * params.size),
        totalItems: remaining.length,
        totalPages: Math.ceil(remaining.length / params.size),
      }
    }
    const selectCurrentPage = (query, selectedRowKeys, selectedRecordsById) => {
      const response = requestPage(query, selectedRowKeys)
      const change = getPageScopedSelectionChange({
        apiRecords: response.records,
        changeRows: response.records,
        selected: true,
        selectedRowKeys,
        getRecordKey: getStudentRowKey,
      })
      return {
        response,
        selectedRowKeys: change.keys,
        selectedRecordsById: change.records.reduce((records, record) => ({
          ...records,
          [getStudentRowKey(record)]: record,
        }), { ...selectedRecordsById }),
      }
    }

    let forwardKeys = []
    let forwardRecordsById = {}
    const firstPage = selectCurrentPage({ page: 1, size: 10 }, forwardKeys, forwardRecordsById)
    expect(firstPage.response.records.map(record => record.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    forwardKeys = firstPage.selectedRowKeys
    forwardRecordsById = firstPage.selectedRecordsById
    let nextPage = requestPage({ page: 1, size: 10 }, forwardKeys)
    expect(nextPage.records.map(record => record.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])

    while (nextPage.records.length) {
      const selected = selectCurrentPage({ page: 1, size: 10 }, forwardKeys, forwardRecordsById)
      forwardKeys = selected.selectedRowKeys
      forwardRecordsById = selected.selectedRecordsById
      nextPage = requestPage({ page: 1, size: 10 }, forwardKeys)
      if (forwardKeys.length === 30) {
        expect(nextPage.records.map(record => record.id)).toEqual([31, 32, 33, 34, 35, 36, 37, 38, 39, 40])
      }
    }
    expect(forwardKeys).toHaveLength(42)
    expect(Object.keys(forwardRecordsById)).toHaveLength(42)
    expect(nextPage.totalPages).toBe(0)

    let backwardKeys = []
    let backwardRecordsById = {}
    let backwardPage = 5
    while (backwardKeys.length < allRecords.length) {
      const selected = selectCurrentPage({ page: backwardPage, size: 10 }, backwardKeys, backwardRecordsById)
      backwardKeys = selected.selectedRowKeys
      backwardRecordsById = selected.selectedRecordsById
      backwardPage = Math.max(1, Math.ceil((allRecords.length - backwardKeys.length) / 10))
    }
    expect(backwardKeys).toHaveLength(42)
    expect(new Set(backwardKeys).size).toBe(42)

    const afterDeselect = requestPage(
      { page: 1, size: 10 },
      forwardKeys.filter(key => key !== '5')
    )
    expect(afterDeselect.records.map(record => record.id)).toEqual([5])
    const reachableIds = new Set([
      ...forwardKeys.filter(key => key !== '5').map(Number),
      ...afterDeselect.records.map(record => record.id),
    ])
    expect(reachableIds).toEqual(new Set(allRecords.map(record => record.id)))
  })
})
