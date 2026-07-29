import React, { useEffect, useMemo, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import {
  Breadcrumb, Button, Card, Dropdown, Input, Menu, message, Modal,
  Pagination, Table, Tag, Tooltip
} from 'antd'
import {
  DeleteOutlined, MoreOutlined, ReloadOutlined, RollbackOutlined
} from '@ant-design/icons'
import ClassService from 'services/ClassService'
import StudentService from 'services/StudentService'
import {
  buildDisplayedStudentRecords, buildStudentOrder, formatStudentDateTime,
  getPageScopedSelectionChange, getStudentRowKey, getStudentSortOrder,
  normalizeStudentRowKeys, toStudentApiIds, unwrapCollection
} from '../studentUtils'

const { Search } = Input

const StudentDeletedList = () => {
  const history = useHistory()
  const location = useLocation()
  const [records, setRecords] = useState([])
  const [pageInfo, setPageInfo] = useState({ total_items: 0, total_pages: 0, current: 1, size: 10 })
  const [query, setQuery] = useState({ page: 1, size: 10, search: '', order: '' })
  const [searchInput, setSearchInput] = useState('')
  const [classMap, setClassMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [selectedRecordsById, setSelectedRecordsById] = useState({})

  const loadStudents = async (nextQuery = query) => {
    setLoading(true)
    try {
      const response = await StudentService.getDeletedByPage({
        page: nextQuery.page,
        size: nextQuery.size,
        search: nextQuery.search,
        order: nextQuery.order || undefined,
      })
      const payload = response?.data || response || {}
      setRecords(unwrapCollection(payload))
      setPageInfo(payload.page_info || { total_items: 0, total_pages: 0, current: nextQuery.page, size: nextQuery.size })
    } catch (error) {
      message.error(error?.response?.data?.message || 'Không thể tải dữ liệu đã xóa')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
    ClassService.getAll()
      .then(response => unwrapCollection(response).reduce((map, item) => ({
        ...map,
        [item.id]: item.name || item.class_name || item.className || item.code || item.id,
      }), {}))
      .then(setClassMap)
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedRowKeys.length || !records.length) return
    setSelectedRecordsById(current => {
      const next = { ...current }
      const selectedKeySet = new Set(selectedRowKeys)
      records.forEach(record => {
        const key = getStudentRowKey(record)
        if (selectedKeySet.has(key)) next[key] = record
      })
      return next
    })
  }, [records, selectedRowKeys])

  const updateSelection = (keys, selectedRecords = []) => {
    const uniqueKeys = normalizeStudentRowKeys(keys)
    const keySet = new Set(uniqueKeys)
    setSelectedRowKeys(uniqueKeys)
    setSelectedRecordsById(current => {
      const next = {}
      uniqueKeys.forEach(key => {
        if (current[key]) next[key] = current[key]
      })
      selectedRecords.forEach(record => {
        const key = getStudentRowKey(record)
        if (keySet.has(key)) next[key] = record
      })
      return next
    })
  }

  const handleRowSelect = (record, selected) => {
    const key = getStudentRowKey(record)
    updateSelection(
      selected ? [...selectedRowKeys, key] : selectedRowKeys.filter(item => item !== key),
      selected ? [record] : []
    )
  }

  const handleSelectAll = (selected, _, changeRows) => {
    const change = getPageScopedSelectionChange({
      apiRecords: records,
      changeRows,
      selected,
      selectedRowKeys,
      getRecordKey: getStudentRowKey,
    })
    updateSelection(change.keys, change.records)
  }

  const adjustAndReload = async (successfulIds, nextQuery = query) => {
    const successful = new Set(normalizeStudentRowKeys(successfulIds))
    updateSelection(selectedRowKeys.filter(id => !successful.has(id)))
    const nextTotal = Math.max(0, Number(pageInfo.total_items || 0) - successful.size)
    const lastPage = Math.max(1, Math.ceil(nextTotal / nextQuery.size))
    const adjustedQuery = { ...nextQuery, page: Math.min(nextQuery.page, lastPage) }
    if (adjustedQuery.page !== query.page) setQuery(adjustedQuery)
    await loadStudents(adjustedQuery)
  }

  const runRestore = async ids => {
    const apiIds = toStudentApiIds(ids)
    if (!apiIds.length || actionLoading) return
    setActionLoading('restore')
    try {
      const response = await StudentService.restoreDeleted(apiIds)
      const result = response?.data || response || {}
      const restored = toStudentApiIds(result.restored)
      const conflicts = toStudentApiIds(result.conflicts)
      const notFound = toStudentApiIds(result.notFound)
      if (restored.length) message.success(`Đã khôi phục ${restored.length} sinh viên`)
      if (conflicts.length) message.warning(`${conflicts.length} sinh viên không thể khôi phục vì trùng code/email/username`)
      if (notFound.length) message.warning(`${notFound.length} sinh viên không còn trong thùng rác`)
      await adjustAndReload(restored)
    } catch (error) {
      message.error(error?.response?.data?.message || 'Không thể khôi phục sinh viên')
    } finally {
      setActionLoading(null)
    }
  }

  const runPermanentDelete = async ids => {
    const apiIds = toStudentApiIds(ids)
    if (!apiIds.length || actionLoading) return
    setActionLoading('permanent')
    try {
      const response = await StudentService.permanentlyDelete(apiIds)
      const result = response?.data || response || {}
      const deleted = toStudentApiIds(result.deleted)
      const notFound = toStudentApiIds(result.notFound)
      if (deleted.length) message.success(`Đã xóa vĩnh viễn ${deleted.length} sinh viên`)
      if (notFound.length) message.warning(`${notFound.length} sinh viên không còn trong thùng rác`)
      await adjustAndReload(deleted)
    } catch (error) {
      message.error(error?.response?.data?.message || 'Không thể xóa vĩnh viễn sinh viên')
    } finally {
      setActionLoading(null)
    }
  }

  const confirmRestore = ids => Modal.confirm({
    title: 'Khôi phục sinh viên',
    content: `Bạn có chắc chắn muốn khôi phục ${ids.length} sinh viên đã chọn không?`,
    okText: 'Khôi phục',
    cancelText: 'Hủy',
    onOk: () => runRestore(ids),
  })

  const confirmPermanentDelete = ids => Modal.confirm({
    title: 'Xóa vĩnh viễn sinh viên',
    content: 'Dữ liệu đã xóa vĩnh viễn sẽ không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?',
    okText: 'Xóa vĩnh viễn',
    okType: 'danger',
    cancelText: 'Hủy',
    onOk: () => runPermanentDelete(ids),
  })

  const handleSearch = value => {
    const nextQuery = { ...query, page: 1, search: value }
    setQuery(nextQuery)
    loadStudents(nextQuery)
  }

  const handlePageChange = (page, size) => {
    const nextQuery = { ...query, page: size !== query.size ? 1 : page, size }
    setQuery(nextQuery)
    loadStudents(nextQuery)
  }

  const handleTableChange = (_, __, sorter) => {
    const order = buildStudentOrder(sorter)
    if (order === query.order) return
    const nextQuery = { ...query, page: 1, order }
    setQuery(nextQuery)
    loadStudents(nextQuery)
  }

  const displayedRecords = useMemo(() => buildDisplayedStudentRecords(
    records, selectedRowKeys, selectedRecordsById, getStudentRowKey
  ), [records, selectedRowKeys, selectedRecordsById])
  const totalItems = Number(pageInfo.total_items) || 0
  const totalPages = Math.max(1, Number(pageInfo.total_pages) || Math.ceil(totalItems / query.size))
  const hasSelection = selectedRowKeys.length > 0
  const isActionLoading = actionLoading !== null

  const columns = [
    {
      key: 'code', dataIndex: 'code', title: 'Mã sinh viên', width: 145,
      sorter: { multiple: 1 }, sortOrder: getStudentSortOrder(query.order, 'code'),
    },
    {
      key: 'fullname', dataIndex: 'fullname', title: 'Họ và tên', width: 200,
      sorter: { multiple: 2 }, sortOrder: getStudentSortOrder(query.order, 'fullname'),
    },
    { key: 'email', dataIndex: 'email', title: 'Email', width: 220, render: value => value || '-' },
    { key: 'username', dataIndex: 'username', title: 'Tài khoản', width: 160, render: value => value || '-' },
    {
      key: 'class_id', dataIndex: 'class_id', title: 'Lớp', width: 160,
      render: value => value === null || value === undefined
        ? <Tag>Chưa xếp lớp</Tag>
        : (classMap[value] || `Lớp #${value}`),
    },
    {
      key: 'deleted_at', dataIndex: 'deleted_at', title: 'Thời điểm xóa', width: 175,
      sorter: { multiple: 3 }, sortOrder: getStudentSortOrder(query.order, 'deleted_at'),
      render: formatStudentDateTime,
    },
    {
      key: 'action', title: 'Hành động', fixed: 'right', align: 'right', width: 125,
      render: (_, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Tooltip title="Khôi phục"><Button type="text" icon={<RollbackOutlined />} disabled={isActionLoading} onClick={() => confirmRestore([getStudentRowKey(record)])} /></Tooltip>
          <Tooltip title="Xóa vĩnh viễn"><Button type="text" danger icon={<DeleteOutlined />} disabled={isActionLoading} onClick={() => confirmPermanentDelete([getStudentRowKey(record)])} /></Tooltip>
        </div>
      ),
    },
  ]

  const actionMenu = (
    <Menu>
      <Menu.Item key="restore" icon={<RollbackOutlined />} disabled={!hasSelection || isActionLoading} onClick={() => confirmRestore(selectedRowKeys)}>Khôi phục dữ liệu đã chọn</Menu.Item>
      <Menu.Item key="permanent" icon={<DeleteOutlined />} danger disabled={!hasSelection || isActionLoading} onClick={() => confirmPermanentDelete(selectedRowKeys)}>Xóa vĩnh viễn dữ liệu đã chọn</Menu.Item>
    </Menu>
  )

  const returnToList = () => history.push('/app/student/list', location.state?.studentListState
    ? { studentListState: location.state.studentListState }
    : undefined)

  return (
    <div className="student-list-page">
      <Breadcrumb className="mb-3">
        <Breadcrumb.Item>Quản lý danh mục</Breadcrumb.Item>
        <Breadcrumb.Item>Sinh viên</Breadcrumb.Item>
        <Breadcrumb.Item>Dữ liệu đã xóa</Breadcrumb.Item>
      </Breadcrumb>
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <h1 className="mb-0">Dữ liệu Sinh viên đã xóa</h1>
        <div className="d-flex align-items-center" style={{ gap: 8 }}>
          <Button onClick={returnToList}>Quay lại danh sách</Button>
          <Dropdown overlay={actionMenu} trigger={['click']}><Button loading={isActionLoading}>Hành động <MoreOutlined /></Button></Dropdown>
          <Search value={searchInput} placeholder="Tìm kiếm sinh viên đã xóa..." onSearch={handleSearch} onChange={event => { setSearchInput(event.target.value); if (!event.target.value) handleSearch('') }} style={{ width: 320 }} allowClear enterButton />
          <Button icon={<ReloadOutlined />} onClick={() => loadStudents()} loading={loading}>Tải lại</Button>
        </div>
      </div>
      {hasSelection && <div className="student-selection-summary">Đã chọn: {selectedRowKeys.length} sinh viên <Button type="link" size="small" onClick={() => updateSelection([])}>Bỏ chọn tất cả</Button></div>}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={displayedRecords}
          rowKey={getStudentRowKey}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={false}
          onChange={handleTableChange}
          rowSelection={{ selectedRowKeys, preserveSelectedRowKeys: true, onSelect: handleRowSelect, onSelectAll: handleSelectAll }}
        />
        <div className="student-list-pagination" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', padding: 16 }}>
          <Pagination current={Number(pageInfo.current) || query.page} pageSize={Number(pageInfo.size) || query.size} total={totalItems} showSizeChanger showTotal={() => `Tổng ${totalItems} sinh viên · ${totalPages} trang`} onChange={handlePageChange} />
        </div>
      </Card>
    </div>
  )
}

export default StudentDeletedList
