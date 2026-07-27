import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Dropdown, Empty, Input, Menu, message,
  Modal, Pagination, Popover, Table, Tooltip,
} from 'antd'
import {
  CopyOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, FilterOutlined,
  ImportOutlined, MoreOutlined, PlusOutlined,
} from '@ant-design/icons'
import ColumnChooser from 'components/shared-components/ColumnChooser'
import DraggableColumnTitle from 'components/shared-components/DraggableColumnTitle'
import ClassService from 'services/ClassService'
import { deleteClass, fetchClassList } from 'redux/actions/Class'
import {
  buildDisplayedStudentRecords, getPageScopedSelectionChange,
} from '../../student/studentUtils'
import {
  buildClassOrder, normalizeClassCopyResponse, normalizeMassClassCopyResponse,
  normalizeMassDeleteResponse, rememberCopiedClassId, saveClassCopyResult,
  trimClassSearch,
} from '../classUtils'
import '../Class.css'

const { Search } = Input

const getErrorMessage = error => (
  error?.response?.data?.message || error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.'
)

const ClassList = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const apiRecords = useSelector(state => state.classroom.list)
  const pageInfo = useSelector(state => state.classroom.pageInfo)
  const listLoading = useSelector(state => state.classroom.listLoading)
  const listError = useSelector(state => state.classroom.error)
  const restoredState = location.state?.classListState
  const restoredQuery = restoredState?.query
  const initialQuery = {
    page: Number(restoredQuery?.page) > 0 ? Number(restoredQuery.page) : 1,
    size: Number(restoredQuery?.size) > 0 ? Number(restoredQuery.size) : 10,
    search: trimClassSearch(restoredQuery?.search),
    order: typeof restoredQuery?.order === 'string' ? restoredQuery.order : '',
  }
  const [query, setQuery] = useState(initialQuery)
  const [searchInput, setSearchInput] = useState(initialQuery.search)
  const [selectedRowKeys, setSelectedRowKeys] = useState(() => (
    Array.isArray(restoredState?.selectedRowKeys)
      ? [...new Set(restoredState.selectedRowKeys
        .map(Number)
        .filter(id => Number.isSafeInteger(id) && id > 0))]
      : []
  ))
  const [selectedRecordsById, setSelectedRecordsById] = useState(() => (
    restoredState?.selectedRecordsById && typeof restoredState.selectedRecordsById === 'object'
      ? restoredState.selectedRecordsById
      : {}
  ))
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const restored = Array.isArray(restoredState?.visibleColumns)
      ? restoredState.visibleColumns
      : ['code', 'name', 'description']
    return [...new Set([...restored, 'code', 'name'])]
  })
  const [columnOrder, setColumnOrder] = useState(() => {
    const defaultOrder = ['code', 'name', 'description']
    const restored = Array.isArray(restoredState?.columnOrder)
      ? restoredState.columnOrder.filter(key => defaultOrder.includes(key))
      : []
    return [...restored, ...defaultOrder.filter(key => !restored.includes(key))]
  })
  const [columnChooserVisible, setColumnChooserVisible] = useState(false)
  const [copyingClassId, setCopyingClassId] = useState(null)
  const [copyingMany, setCopyingMany] = useState(false)

  const getClassListState = () => ({
    query,
    selectedRowKeys,
    selectedRecordsById,
    visibleColumns,
    columnOrder,
  })

  const loadClasses = (nextQuery = query) => {
    dispatch(fetchClassList({
      page: nextQuery.page,
      size: nextQuery.size,
      search: nextQuery.search || undefined,
      order: nextQuery.order || undefined,
      columnlist: 'id,code,name,description',
    }))
  }

  useEffect(() => {
    loadClasses(initialQuery)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedRowKeys.length || !apiRecords.length) return
    setSelectedRecordsById(current => {
      const next = { ...current }
      apiRecords.forEach(record => {
        if (selectedRowKeys.includes(record.id)) next[record.id] = record
      })
      return next
    })
  }, [apiRecords, selectedRowKeys])

  useEffect(() => {
    if (listLoading || query.page <= 1) return
    const responsePage = Number(pageInfo.current)
    const responseTotalPages = Number(pageInfo.total_pages)
    if (responsePage !== query.page || responseTotalPages >= query.page) return
    const nextQuery = { ...query, page: Math.max(1, responseTotalPages) }
    setQuery(nextQuery)
    loadClasses(nextQuery)
  }, [listLoading, pageInfo.current, pageInfo.total_pages, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSelection = (keys, records = []) => {
    const uniqueKeys = [...new Set(keys)]
    setSelectedRowKeys(uniqueKeys)
    setSelectedRecordsById(current => {
      const next = {}
      uniqueKeys.forEach(key => {
        if (current[key]) next[key] = current[key]
      })
      records.forEach(record => {
        if (uniqueKeys.includes(record.id)) next[record.id] = record
      })
      return next
    })
  }

  const handleRowSelect = (record, selected) => {
    updateSelection(
      selected
        ? [...selectedRowKeys, record.id]
        : selectedRowKeys.filter(key => key !== record.id),
      selected ? [record] : []
    )
  }

  const handleSelectAll = (selected, _, changeRows) => {
    const change = getPageScopedSelectionChange({
      apiRecords,
      changeRows,
      selected,
      selectedRowKeys,
    })
    updateSelection(change.keys, change.records)
  }

  const openClassPage = pathname => {
    history.push(pathname, { classListState: getClassListState() })
  }

  const reloadAfterRemoval = removedCount => {
    const nextTotal = Math.max(0, (Number(pageInfo.total_items) || 0) - removedCount)
    const lastPage = Math.max(1, Math.ceil(nextTotal / query.size))
    const nextQuery = { ...query, page: Math.min(query.page, lastPage) }
    setQuery(nextQuery)
    loadClasses(nextQuery)
  }

  const executeDeleteOne = record => new Promise((resolve, reject) => {
    dispatch(deleteClass(
      record.id,
      () => {
        updateSelection(selectedRowKeys.filter(key => key !== record.id))
        reloadAfterRemoval(1)
        message.success('Xóa lớp thành công')
        resolve()
      },
      (error, status) => {
        if (error?.code === 'G605' || Number(status) === 409) {
          message.error('Không thể xóa lớp vì vẫn còn sinh viên thuộc lớp này.')
        } else {
          message.error(error?.message || 'Không thể xóa lớp')
        }
        reject(error)
      }
    ))
  })

  const confirmDeleteOne = (record, event) => {
    event?.stopPropagation()
    Modal.confirm({
      title: 'Xác nhận xóa lớp',
      content: `Bạn có chắc chắn muốn xóa lớp “${record.name || '-'}” không?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => executeDeleteOne(record),
    })
  }

  const handleCopyOne = async record => {
    if (copyingClassId !== null) return
    setCopyingClassId(record.id)
    try {
      const response = await ClassService.copyOne(record.id)
      const created = normalizeClassCopyResponse(response)
      const createdId = Number(created?.id)
      if (!Number.isSafeInteger(createdId) || createdId <= 0) {
        throw new Error('Không nhận được ID của bản sao')
      }
      rememberCopiedClassId(createdId)
      message.success('Sao chép lớp thành công')
      history.push(`/app/class/copy/${createdId}`, {
        classListState: getClassListState(),
        copiedClass: created,
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCopyingClassId(null)
    }
  }

  const executeMassCopy = async () => {
    setCopyingMany(true)
    try {
      const response = await ClassService.massCopy(selectedRowKeys)
      const result = normalizeMassClassCopyResponse(response)
      saveClassCopyResult(result)
      const listState = {
        ...getClassListState(),
        selectedRowKeys: [],
        selectedRecordsById: {},
      }
      updateSelection([])
      history.push('/app/class/copy-result', {
        copyResult: result,
        classListState: listState,
      })
    } catch (error) {
      message.error(getErrorMessage(error))
      throw error
    } finally {
      setCopyingMany(false)
    }
  }

  const confirmMassCopy = () => {
    if (!selectedRowKeys.length || copyingMany) return
    Modal.confirm({
      title: 'Xác nhận sao chép lớp',
      content: `Sao chép ${selectedRowKeys.length} lớp đã chọn?`,
      okText: 'Sao chép',
      cancelText: 'Hủy',
      onOk: executeMassCopy,
    })
  }

  const executeMassDelete = async () => {
    try {
      const response = await ClassService.massDestroy(selectedRowKeys)
      const { deletedIds, blockedIds } = normalizeMassDeleteResponse(response)
      updateSelection(selectedRowKeys.filter(key => !deletedIds.includes(key)))
      reloadAfterRemoval(deletedIds.length)

      if (blockedIds.length) {
        message.warning(
          `Đã xóa ${deletedIds.length} lớp, ${blockedIds.length} lớp không thể xóa vì còn sinh viên.`
        )
      } else if (deletedIds.length) {
        message.success(`Đã xóa ${deletedIds.length} lớp`)
      } else {
        message.warning('Không có lớp nào được xóa')
      }
    } catch (error) {
      message.error(getErrorMessage(error))
      throw error
    }
  }

  const confirmMassDelete = () => {
    if (!selectedRowKeys.length) return
    Modal.confirm({
      title: 'Xác nhận xóa lớp',
      content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} lớp đã chọn không?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: executeMassDelete,
    })
  }

  const handleSearch = value => {
    const search = trimClassSearch(value)
    setSearchInput(search)
    const nextQuery = { ...query, page: 1, search }
    setQuery(nextQuery)
    loadClasses(nextQuery)
  }

  const handlePageChange = (page, size) => {
    const nextQuery = {
      ...query,
      page: size !== query.size ? 1 : page,
      size,
    }
    setQuery(nextQuery)
    loadClasses(nextQuery)
  }

  const handleTableChange = (_, __, sorter) => {
    const order = buildClassOrder(sorter)
    if (order === query.order) return
    const nextQuery = { ...query, page: 1, order }
    setQuery(nextQuery)
    loadClasses(nextQuery)
  }

  const moveColumn = (sourceKey, targetKey) => {
    setColumnOrder(current => {
      const sourceIndex = current.indexOf(sourceKey)
      const targetIndex = current.indexOf(targetKey)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current
      const next = [...current]
      next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, sourceKey)
      return next
    })
  }

  const getSortOrder = key => {
    const alias = { code: 'co', name: 'na', description: 'de' }[key]
    const match = query.order.split('-').find(part => part.startsWith(`${alias}:`))
    if (!match) return null
    return match.endsWith(':1') ? 'descend' : 'ascend'
  }

  const columnConfig = useMemo(() => [
    {
      key: 'code',
      dataIndex: 'code',
      title: 'Mã lớp',
      label: 'Mã lớp',
      required: true,
      width: 180,
      sorter: { multiple: 3 },
      sortOrder: getSortOrder('code'),
      render: value => value || '-',
    },
    {
      key: 'name',
      dataIndex: 'name',
      title: 'Tên lớp',
      label: 'Tên lớp',
      required: true,
      width: 240,
      sorter: { multiple: 2 },
      sortOrder: getSortOrder('name'),
      render: value => value || '-',
    },
    {
      key: 'description',
      dataIndex: 'description',
      title: 'Mô tả',
      label: 'Mô tả',
      width: 360,
      sorter: { multiple: 1 },
      sortOrder: getSortOrder('description'),
      ellipsis: true,
      render: value => value
        ? <Tooltip title={value}><span>{value}</span></Tooltip>
        : '-',
    },
  ], [query.order]) // eslint-disable-line react-hooks/exhaustive-deps

  const orderedColumns = columnOrder
    .map(key => columnConfig.find(column => column.key === key))
    .filter(Boolean)

  const tableColumns = orderedColumns
    .filter(column => visibleColumns.includes(column.key))
    .map(column => ({
      ...column,
      title: <DraggableColumnTitle column={column} moveColumn={moveColumn} />,
    }))
    .concat({
      title: 'Hành động',
      key: 'action',
      align: 'right',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <div className="d-flex justify-content-end" onClick={event => event.stopPropagation()}>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openClassPage(`/app/class/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={event => confirmDeleteOne(record, event)}
            />
          </Tooltip>
          <Dropdown
            trigger={['click']}
            disabled={copyingClassId !== null}
            overlay={(
              <Menu onClick={({ domEvent }) => domEvent?.stopPropagation()}>
                <Menu.Item
                  key="copy"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyOne(record)}
                >
                  Sao chép
                </Menu.Item>
              </Menu>
            )}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              loading={copyingClassId === record.id}
              onClick={event => event.stopPropagation()}
            />
          </Dropdown>
        </div>
      ),
    })

  const displayedRecords = buildDisplayedStudentRecords(
    apiRecords,
    selectedRowKeys,
    selectedRecordsById
  )
  const totalItems = Number(pageInfo.total_items) || 0
  const totalPages = Math.max(
    1,
    Number(pageInfo.total_pages) || Math.ceil(totalItems / query.size)
  )
  const hasSelection = selectedRowKeys.length > 0

  const actionMenu = (
    <Menu>
      <Menu.Item
        key="import"
        icon={<ImportOutlined />}
        onClick={() => openClassPage('/app/class/import')}
      >
        Nhập dữ liệu từ file
      </Menu.Item>
      <Menu.Item
        key="export"
        icon={<DownloadOutlined />}
        onClick={() => openClassPage('/app/class/export')}
      >
        Xuất dữ liệu theo mẫu
      </Menu.Item>
      <Menu.Item
        key="copy"
        icon={<CopyOutlined />}
        disabled={!hasSelection || copyingMany}
        onClick={confirmMassCopy}
      >
        Sao chép dữ liệu đã chọn
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item
        key="delete"
        danger
        icon={<DeleteOutlined />}
        disabled={!hasSelection}
        onClick={confirmMassDelete}
      >
        Xóa dữ liệu đã chọn
      </Menu.Item>
    </Menu>
  )

  const columnChooser = (
    <ColumnChooser
      columns={orderedColumns}
      value={visibleColumns}
      requiredKeys={['code', 'name']}
      onChange={keys => setVisibleColumns([...new Set([...keys, 'code', 'name'])])}
      onClose={() => setColumnChooserVisible(false)}
    />
  )

  return (
      <div className="class-list-page">
        <Breadcrumb>
          <Breadcrumb.Item>Quản lý danh mục</Breadcrumb.Item>
          <Breadcrumb.Item>Danh mục Lớp</Breadcrumb.Item>
        </Breadcrumb>
        <div className="class-list-toolbar">
          <h1>Danh sách Lớp</h1>
          <div className="class-list-toolbar-actions">
            <Dropdown overlay={actionMenu} trigger={['click']}>
              <Button>Hành động <MoreOutlined /></Button>
            </Dropdown>
            <Popover
              title="Hiện cột"
              content={columnChooser}
              trigger="click"
              placement="bottomRight"
              visible={columnChooserVisible}
              onVisibleChange={setColumnChooserVisible}
              destroyTooltipOnHide={false}
            >
              <Button icon={<FilterOutlined />}>Hiện cột</Button>
            </Popover>
            <Search
              value={searchInput}
              placeholder="Tìm mã, tên hoặc mô tả lớp..."
              allowClear
              enterButton
              onChange={event => {
                const value = event.target.value
                setSearchInput(value)
                if (!value && query.search) handleSearch('')
              }}
              onSearch={handleSearch}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<PlusOutlined />}
              aria-label="Thêm mới lớp"
              onClick={() => openClassPage('/app/class/create')}
            />
          </div>
        </div>

        {hasSelection && (
          <div className="class-selection-summary">
            Đã chọn: {selectedRowKeys.length} lớp
            <Button type="link" size="small" onClick={() => updateSelection([])}>
              Bỏ chọn tất cả
            </Button>
          </div>
        )}
        {listError && <Alert className="mb-3" type="error" showIcon message={listError} />}

        <Card bodyStyle={{ padding: 0 }}>
          <Table
            rowKey="id"
            columns={tableColumns}
            dataSource={displayedRecords}
            loading={listLoading}
            pagination={false}
            scroll={{ x: 'max-content' }}
            onChange={handleTableChange}
            rowSelection={{
              selectedRowKeys,
              preserveSelectedRowKeys: true,
              onSelect: handleRowSelect,
              onSelectAll: handleSelectAll,
            }}
            locale={{
              emptyText: <Empty description={
                query.search ? 'Không tìm thấy lớp phù hợp' : 'Chưa có dữ liệu lớp'
              } />,
            }}
          />
          <div className="class-list-pagination">
            <Pagination
              current={Number(pageInfo.current) || query.page}
              pageSize={Number(pageInfo.size) || query.size}
              total={totalItems}
              showSizeChanger
              showTotal={() => `Tổng ${totalItems} lớp · ${totalPages} trang`}
              onChange={handlePageChange}
            />
          </div>
        </Card>
      </div>
  )
}

export default ClassList
