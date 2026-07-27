import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import {
  Avatar, Button, Card, Dropdown, Input, Menu, message, Modal,
  Pagination, Popover, Table, Tag, Tooltip
} from 'antd'
import {
  CopyOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined,
  FilterOutlined, MoreOutlined, PlusOutlined, UploadOutlined, UserOutlined
} from '@ant-design/icons'
import ClassService from 'services/ClassService'
import HobbyService from 'services/HobbyService'
import StudentService from 'services/StudentService'
import ColumnChooser from 'components/shared-components/ColumnChooser'
import DraggableColumnTitle from 'components/shared-components/DraggableColumnTitle'
import downloadBlob, {
  getBlobErrorMessage, getDownloadFilename
} from 'utils/downloadBlob'
import { deleteStudent, fetchStudentList } from 'redux/actions/Student'
import { decodeHobbyBitmask } from '../student-create/studentFormUtils'
import {
  buildDisplayedStudentRecords, buildStudentOrder, formatStudentDate as formatDate,
  getPageScopedSelectionChange, getSafeHttpUrl, getStudentSortOrder
} from '../studentUtils'
import {
  getCopyErrorMessage, normalizeMassCopyResponse, rememberCopiedStudentId,
  saveCopyResultSession, unwrapCopiedStudent
} from '../student-copy/copyUtils'

const { Search } = Input
const getCount = value => Array.isArray(value) ? value.length : Number(value) || 0

const StudentList = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const apiRecords = useSelector(state => state.student.list)
  const pageInfo = useSelector(state => state.student.pageInfo)
  const listLoading = useSelector(state => state.student.listLoading)
  const restoredListState = location.state?.studentListState
  const restoredQuery = restoredListState?.query
  const initialQuery = {
    page: Number(restoredQuery?.page) > 0 ? Number(restoredQuery.page) : 1,
    size: Number(restoredQuery?.size) > 0 ? Number(restoredQuery.size) : 10,
    search: typeof restoredQuery?.search === 'string' ? restoredQuery.search : '',
    order: typeof restoredQuery?.order === 'string' ? restoredQuery.order : '',
  }
  const [classMap, setClassMap] = useState({})
  const [hobbyMap, setHobbyMap] = useState({})
  const [query, setQuery] = useState(initialQuery)
  const [selectedRowKeys, setSelectedRowKeys] = useState(() => (
    Array.isArray(restoredListState?.selectedRowKeys)
      ? [...new Set(restoredListState.selectedRowKeys
        .map(Number)
        .filter(id => Number.isSafeInteger(id) && id > 0))]
      : []
  ))
  const [selectedRecordsById, setSelectedRecordsById] = useState(() => (
    restoredListState?.selectedRecordsById && typeof restoredListState.selectedRecordsById === 'object'
      ? restoredListState.selectedRecordsById
      : {}
  ))
  const [columnChooserVisible, setColumnChooserVisible] = useState(false)
  const [copyingStudentId, setCopyingStudentId] = useState(null)
  const [exportingStudentId, setExportingStudentId] = useState(null)
  const [bulkCopyVisible, setBulkCopyVisible] = useState(false)
  const [copyingMany, setCopyingMany] = useState(false)

  const loadStudents = (nextQuery = query) => {
    const params = {
      page: nextQuery.page,
      size: nextQuery.size,
      search: nextQuery.search,
      order: nextQuery.order || undefined,
    }
    dispatch(fetchStudentList(params))
  }

  useEffect(() => {
    loadStudents(initialQuery)
    ClassService.getAll()
      .then(response => {
        const data = response?.data || response
        const records = data?.records || data || []
        if (!Array.isArray(records)) return
        setClassMap(records.reduce((map, item) => ({
          ...map,
          [item.id]: item.name || item.class_name || item.className || item.code || item.id
        }), {}))
      })
      .catch(() => {})
    HobbyService.getAll()
      .then(response => {
        const data = response?.data || response
        const records = data?.records || data || []
        if (!Array.isArray(records)) return
        setHobbyMap(records.reduce((map, item) => {
          const bitValue = Number(item.bit_value)
          if (!Number.isInteger(bitValue) || bitValue <= 0) return map
          return {
            ...map,
            [bitValue]: item.name || item.code || String(bitValue)
          }
        }, {}))
      })
      .catch(() => {})
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
    loadStudents(nextQuery)
  }, [listLoading, pageInfo.current, pageInfo.total_pages, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderClassName = (classId, record) => {
    const joinedClass = record?.class || record?.class_info
    const className = joinedClass?.name || joinedClass?.class_name || joinedClass?.className || joinedClass?.code
    if (className) return className
    if (classId !== null && classId !== undefined) {
      return classMap[classId] || `Lớp #${classId}`
    }
    return <Tag color="default">Chưa xếp lớp</Tag>
  }

  const renderHobbyNames = value => {
    if (Array.isArray(value)) {
      const names = value
        .map(item => {
          if (item && typeof item === 'object') return item.name || item.code
          const bitValue = Number(item)
          if (hobbyMap[bitValue]) return hobbyMap[bitValue]
          return typeof item === 'string' && !/^\d+$/.test(item.trim()) ? item : null
        })
        .filter(Boolean)
      return names.length ? names.join(', ') : '-'
    }

    if (typeof value === 'string' && value.trim() && !/^\d+$/.test(value.trim())) {
      return value
    }

    const mask = Number(value)
    if (!Number.isSafeInteger(mask) || mask <= 0) return '-'

    const hobbyOptions = Object.entries(hobbyMap).map(([bitValue, name]) => ({
      bit_value: Number(bitValue),
      name,
    }))
    const names = decodeHobbyBitmask(mask, hobbyOptions)
      .sort((left, right) => Number(left.bit_value) - Number(right.bit_value))
      .map(item => item.name)
    return names.length ? names.join(', ') : '-'
  }

  const columnConfig = [
    {
      key: 'fullname',
      dataIndex: 'fullname',
      title: 'Họ và tên',
      label: 'Họ và tên',
      defaultVisible: true,
      required: true,
      width: 190,
      sorter: { multiple: 2 },
      sortOrder: getStudentSortOrder(query.order, 'fullname'),
    },
    {
      key: 'code',
      dataIndex: 'code',
      title: 'Mã sinh viên',
      label: 'Mã sinh viên',
      defaultVisible: true,
      required: true,
      width: 140,
      sorter: { multiple: 1 },
      sortOrder: getStudentSortOrder(query.order, 'code'),
    },
    { key: 'dob', dataIndex: 'dob', title: 'Ngày sinh', label: 'Ngày sinh', defaultVisible: true, width: 120, render: formatDate },
    { key: 'sex', dataIndex: 'sex', title: 'Giới tính', label: 'Giới tính', defaultVisible: true, width: 105, render: sex => sex === true ? 'Nam' : sex === false ? 'Nữ' : '-' },
    { key: 'class_id', dataIndex: 'class_id', title: 'Lớp', label: 'Lớp', defaultVisible: true, width: 150, render: renderClassName },
    { key: 'email', dataIndex: 'email', title: 'Email', label: 'Email', defaultVisible: true, width: 220, render: value => value || '-' },
    { key: 'homecity', dataIndex: 'homecity', title: 'Quê quán', label: 'Quê quán', defaultVisible: false, width: 160, render: value => value || '-' },
    { key: 'address', dataIndex: 'address', title: 'Địa chỉ', label: 'Địa chỉ', defaultVisible: false, width: 240, render: value => value ? <Tooltip title={value}><span className="text-truncate d-inline-block" style={{ maxWidth: 210 }}>{value}</span></Tooltip> : '-' },
    { key: 'hobbies', dataIndex: 'hobbies', title: 'Sở thích', label: 'Sở thích', defaultVisible: false, width: 180, render: value => Array.isArray(value) ? value.filter(Boolean).join(', ') || '-' : typeof value === 'string' ? value || '-' : '-' },
    { key: 'hair_color', dataIndex: 'hair_color', title: 'Màu tóc', label: 'Màu tóc', defaultVisible: false, width: 135, render: value => typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? <span className="d-inline-flex align-items-center"><span className="mr-2" style={{ width: 14, height: 14, border: '1px solid #d9d9d9', backgroundColor: value }} />{value}</span> : '-' },
    { key: 'facebook', dataIndex: 'facebook', title: 'Facebook', label: 'Facebook', defaultVisible: false, width: 160, render: value => { const url = getSafeHttpUrl(value); return url ? <a href={url} target="_blank" rel="noopener noreferrer">Mở liên kết</a> : '-' } },
    { key: 'username', dataIndex: 'username', title: 'Tài khoản', label: 'Tài khoản', defaultVisible: false, width: 150, render: value => value || '-' },
    { key: 'description', dataIndex: 'description', title: 'Mô tả', label: 'Mô tả', defaultVisible: false, width: 240, render: value => value ? <Tooltip title={value}><span className="text-truncate d-inline-block" style={{ maxWidth: 210 }}>{value}</span></Tooltip> : '-' },
    { key: 'attachment', dataIndex: 'attachment', title: 'Ảnh thẻ', label: 'Ảnh thẻ', defaultVisible: false, width: 90, render: value => <Avatar shape="square" size={28} src={getSafeHttpUrl(value) || undefined} icon={<UserOutlined />} /> }
  ]

  const hobbyColumn = columnConfig.find(column => column.key === 'hobbies')
  if (hobbyColumn) {
    hobbyColumn.width = 220
    hobbyColumn.render = renderHobbyNames
  }

  const [visibleColumns, setVisibleColumns] = useState(() => columnConfig
    .filter(column => (
      column.required ||
      (Array.isArray(restoredListState?.visibleColumns)
        ? restoredListState.visibleColumns.includes(column.key)
        : column.defaultVisible)
    ))
    .map(column => column.key))
  const [columnOrder, setColumnOrder] = useState(() => {
    const defaultOrder = columnConfig.map(column => column.key)
    if (!Array.isArray(restoredListState?.columnOrder)) return defaultOrder
    const restoredOrder = restoredListState.columnOrder.filter(key => defaultOrder.includes(key))
    return [...restoredOrder, ...defaultOrder.filter(key => !restoredOrder.includes(key))]
  })

  const getStudentListState = () => ({
    query,
    visibleColumns,
    columnOrder,
    selectedRowKeys,
    selectedRecordsById,
  })

  const openStudentPage = (pathname) => {
    history.push(pathname, {
      studentListState: getStudentListState()
    })
  }
  const openStudentDetail = id => openStudentPage(`/app/student/detail/${id}`)
  const openStudentEdit = id => openStudentPage(`/app/student/edit/${id}`)
  const openStudentImport = () => openStudentPage('/app/student/import')
  const openStudentExport = () => openStudentPage('/app/student/export')

  const orderedColumnConfig = useMemo(() => columnOrder
    .map(key => columnConfig.find(column => column.key === key))
    .filter(Boolean), [columnOrder, classMap, hobbyMap, query.order]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayedRecords = useMemo(() => {
    return buildDisplayedStudentRecords(apiRecords, selectedRowKeys, selectedRecordsById)
  }, [apiRecords, selectedRecordsById, selectedRowKeys])
  const totalItems = Number(pageInfo.total_items) || 0
  const totalPages = Math.max(1, Number(pageInfo.total_pages) || Math.ceil(totalItems / query.size))

  const moveColumn = (sourceKey, targetKey) => {
    setColumnOrder(currentOrder => {
      const sourceIndex = currentOrder.indexOf(sourceKey)
      const targetIndex = currentOrder.indexOf(targetKey)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return currentOrder
      const nextOrder = [...currentOrder]
      nextOrder.splice(sourceIndex, 1)
      nextOrder.splice(targetIndex, 0, sourceKey)
      return nextOrder
    })
  }

  const tableColumns = orderedColumnConfig
    .filter(column => visibleColumns.includes(column.key))
    .map(column => ({
      ...column,
      title: <DraggableColumnTitle column={column} moveColumn={moveColumn} />
    }))
    .concat({
      title: 'Hành động', key: 'action', align: 'right', fixed: 'right', width: 170,
      render: (_, record) => (
        <div
          className="text-right d-flex justify-content-end align-items-center"
          onClick={event => event.stopPropagation()}
        >
          <Tooltip title="Xem chi tiết"><Button type="text" icon={<EyeOutlined />} size="small" onClick={() => openStudentDetail(record.id)} /></Tooltip>
          <Tooltip title="Chỉnh sửa"><Button type="text" icon={<EditOutlined />} size="small" onClick={() => openStudentEdit(record.id)} /></Tooltip>
          <Tooltip title="Xóa">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={event => confirmDeleteOne(record, event)}
            />
          </Tooltip>
          <Dropdown
            overlay={getStudentActionMenu(record)}
            trigger={['click']}
            disabled={copyingStudentId !== null || exportingStudentId !== null}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
              loading={copyingStudentId === record.id || exportingStudentId === record.id}
              onClick={event => event.stopPropagation()}
            />
          </Dropdown>
        </div>
      )
    })

  const updateSelection = (keys, records = []) => {
    const uniqueKeys = Array.from(new Set(keys))
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
    const keys = selected
      ? [...selectedRowKeys, record.id]
      : selectedRowKeys.filter(key => key !== record.id)
    updateSelection(keys, selected ? [record] : [])
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

  const handleSearch = value => {
    const nextQuery = { ...query, page: 1, search: value }
    setQuery(nextQuery)
    loadStudents(nextQuery)
  }

  const handlePageChange = (page, size) => {
    const nextQuery = {
      ...query,
      page: size !== query.size ? 1 : page,
      size,
    }
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

  const handleColumnVisibilityChange = keys => {
    const requiredKeys = columnConfig.filter(column => column.required).map(column => column.key)
    setVisibleColumns(Array.from(new Set([...keys, ...requiredKeys])))
  }

  const handleCopyOne = async id => {
    if (copyingStudentId !== null) return
    setCopyingStudentId(id)
    try {
      const response = await StudentService.copyOne(id)
      const created = unwrapCopiedStudent(response)
      const newId = Number(created?.id)
      if (!Number.isSafeInteger(newId) || newId <= 0) {
        throw new Error('Không nhận được ID của bản sao.')
      }
      rememberCopiedStudentId(newId)
      message.success('Sao chép sinh viên thành công')
      history.push(`/app/student/copy/${newId}`, {
        studentListState: getStudentListState(),
        copiedStudent: created,
      })
    } catch (error) {
      message.error(getCopyErrorMessage(error))
    } finally {
      setCopyingStudentId(null)
    }
  }

  const handleExportOne = async (record, type) => {
    if (exportingStudentId !== null || copyingStudentId !== null) return
    setExportingStudentId(record.id)
    try {
      const response = await StudentService.exportOne(record.id, type)
      const blob = response?.data
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('File export rỗng')
      }
      const fallbackCode = String(record.code || record.id).replace(/[\\/:*?"<>|]/g, '-')
      const filename = getDownloadFilename(
        response.headers?.['content-disposition'],
        `student-${fallbackCode}.${type}`
      )
      downloadBlob(blob, filename)
    } catch (error) {
      message.error(await getBlobErrorMessage(
        error,
        'Không thể export sinh viên. Vui lòng thử lại.'
      ))
    } finally {
      setExportingStudentId(null)
    }
  }

  const getStudentActionMenu = record => (
    <Menu
      onClick={({ key, domEvent }) => {
        domEvent?.stopPropagation()
        if (key === 'copy') {
          handleCopyOne(record.id)
          return
        }
        if (key.startsWith('export-')) {
          handleExportOne(record, key.replace('export-', ''))
        }
      }}
    >
      <Menu.Item
        key="copy"
        icon={<CopyOutlined />}
        disabled={copyingStudentId !== null || exportingStudentId !== null}
      >
        Sao chép
      </Menu.Item>
      <Menu.SubMenu
        key="export"
        icon={<DownloadOutlined />}
        title="Export"
        disabled={copyingStudentId !== null || exportingStudentId !== null}
      >
        <Menu.Item key="export-csv">CSV</Menu.Item>
        <Menu.Item key="export-xlsx">XLSX</Menu.Item>
        <Menu.Item key="export-json">JSON</Menu.Item>
        <Menu.Item key="export-xml">XML</Menu.Item>
      </Menu.SubMenu>
    </Menu>
  )

  const executeDeleteOne = record => new Promise((resolve, reject) => {
    dispatch(deleteStudent(
      record.id,
      () => {
        const nextKeys = selectedRowKeys.filter(key => key !== record.id)
        const nextTotal = Math.max(0, totalItems - 1)
        const nextLastPage = Math.max(1, Math.ceil(nextTotal / query.size))
        const nextQuery = { ...query, page: Math.min(query.page, nextLastPage) }

        updateSelection(nextKeys)
        setQuery(nextQuery)
        loadStudents(nextQuery)
        message.success('Xóa sinh viên thành công')
        resolve()
      },
      error => {
        message.error(error?.message || 'Lỗi xóa sinh viên')
        reject(error)
      }
    ))
  })

  const confirmDeleteOne = (record, event) => {
    event?.stopPropagation()
    Modal.confirm({
      title: 'Xác nhận xóa sinh viên',
      content: `Bạn có chắc chắn muốn xóa sinh viên “${record.fullname || '-'}” không?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => executeDeleteOne(record),
    })
  }

  const hasSelection = selectedRowKeys.length > 0

  const handleBulkCopy = () => {
    if (!hasSelection || copyingMany) return
    setBulkCopyVisible(true)
  }

  const executeBulkCopy = async () => {
    if (!hasSelection || copyingMany) return
    setCopyingMany(true)
    try {
      const response = await StudentService.massCopy(selectedRowKeys)
      const copyResult = normalizeMassCopyResponse(response)
      const clearedListState = {
        ...getStudentListState(),
        selectedRowKeys: [],
        selectedRecordsById: {},
      }
      saveCopyResultSession(copyResult)
      updateSelection([])
      setBulkCopyVisible(false)
      history.push('/app/student/copy-result', {
        copyResult,
        studentListState: clearedListState,
      })
    } catch (error) {
      message.error(getCopyErrorMessage(error))
    } finally {
      setCopyingMany(false)
    }
  }

  const executeBulkDelete = async () => {
    try {
      const response = await StudentService.massDestroy(selectedRowKeys)
      const result = response?.data || {}
      const notFoundCount = getCount(result.notFound)
      const deletedCount = result.deleted === undefined ? selectedRowKeys.length - notFoundCount : getCount(result.deleted)
      const deletedIds = Array.isArray(result.deleted)
        ? result.deleted.map(item => typeof item === 'object' ? item.id : item)
        : deletedCount === selectedRowKeys.length ? selectedRowKeys : []
      if (deletedCount > 0) message.success(`Đã xóa ${deletedCount} sinh viên`)
      if (notFoundCount > 0) message.warning(`${notFoundCount} sinh viên không tìm thấy hoặc không thể xóa`)
      if (deletedCount === 0) message.warning('Không có sinh viên nào được xóa')
      const remainingKeys = deletedIds.length
        ? selectedRowKeys.filter(key => !deletedIds.includes(key))
        : selectedRowKeys
      updateSelection(remainingKeys)
      loadStudents()
    } catch (error) {
      message.error(error.response?.data?.message || 'Lỗi xóa sinh viên')
      return Promise.reject(error)
    }
  }

  const confirmBulkDelete = () => {
    if (!hasSelection) {
      message.warning('Vui lòng chọn ít nhất một sinh viên')
      return
    }
    const selectedStudent = selectedRowKeys.length === 1 ? selectedRecordsById[selectedRowKeys[0]] : null
    const content = selectedStudent
      ? `Bạn có chắc chắn muốn xóa sinh viên '${selectedStudent.fullname || '-'}' không? Hành động này không thể hoàn tác trên giao diện.`
      : `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} sinh viên đã chọn không? Hành động này không thể hoàn tác trên giao diện.`
    Modal.confirm({ title: 'Xác nhận xóa sinh viên', content, okText: 'Xóa', okType: 'danger', cancelText: 'Hủy', onOk: executeBulkDelete })
  }

  const columnChooser = (
    <ColumnChooser
      columns={orderedColumnConfig}
      value={visibleColumns}
      requiredKeys={columnConfig.filter(column => column.required).map(column => column.key)}
      onChange={handleColumnVisibilityChange}
      onClose={() => setColumnChooserVisible(false)}
    />
  )

  const bulkActionMenu = (
    <Menu>
      <Menu.Item key="import" icon={<UploadOutlined />} onClick={openStudentImport}>Nhập dữ liệu từ file</Menu.Item>
      <Menu.Item key="export" icon={<DownloadOutlined />} onClick={openStudentExport}>Xuất dữ liệu theo mẫu</Menu.Item>
      <Menu.Item key="copy" icon={<CopyOutlined />} disabled={!hasSelection || copyingMany} onClick={handleBulkCopy}>Sao chép dữ liệu đã chọn</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger disabled={!hasSelection} onClick={confirmBulkDelete}>Xóa dữ liệu đã chọn</Menu.Item>
    </Menu>
  )

  return (
      <div className="student-list-page">
        <div className="mb-3 d-flex justify-content-between align-items-center">
          <h2 className="mb-0">Danh sách Sinh viên</h2>
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <Dropdown overlay={bulkActionMenu} trigger={['click']}><Button>Hành động <MoreOutlined /></Button></Dropdown>
            <Popover title="Hiện cột" content={columnChooser} trigger="click" placement="bottomRight" visible={columnChooserVisible} onVisibleChange={setColumnChooserVisible} getPopupContainer={() => document.body} overlayClassName="student-column-chooser-overlay" destroyTooltipOnHide>
              <Button icon={<FilterOutlined />}>Hiện cột</Button>
            </Popover>
            <Search placeholder="Tìm kiếm sinh viên..." defaultValue={query.search} onSearch={handleSearch} onChange={event => !event.target.value && handleSearch('')} style={{ width: 280 }} allowClear />
            <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={() => history.push('/app/student/create')} />
          </div>
        </div>
        {hasSelection && <div className="student-selection-summary">Đã chọn: {selectedRowKeys.length} sinh viên <Button type="link" size="small" onClick={() => updateSelection([])}>Bỏ chọn tất cả</Button></div>}
        <Card bodyStyle={{ padding: 0 }}>
          <Table
            columns={tableColumns}
            dataSource={displayedRecords}
            rowKey="id"
            loading={listLoading}
            scroll={{ x: 'max-content' }}
            rowSelection={{ selectedRowKeys, preserveSelectedRowKeys: true, onSelect: handleRowSelect, onSelectAll: handleSelectAll }}
            pagination={false}
            onChange={handleTableChange}
          />
          <div className="student-list-pagination" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', padding: 16 }}>
            <Pagination
              current={Number(pageInfo.current) || query.page}
              pageSize={Number(pageInfo.size) || query.size}
              total={totalItems}
              showSizeChanger
              showTotal={() => `Tổng ${totalItems} sinh viên · ${totalPages} trang`}
              onChange={handlePageChange}
            />
          </div>
        </Card>
        <Modal
          visible={bulkCopyVisible}
          title="Xác nhận sao chép sinh viên"
          okText="Sao chép"
          cancelText="Hủy"
          confirmLoading={copyingMany}
          closable={!copyingMany}
          maskClosable={!copyingMany}
          onOk={executeBulkCopy}
          onCancel={() => !copyingMany && setBulkCopyVisible(false)}
        >
          Sao chép {selectedRowKeys.length} sinh viên đã chọn?
        </Modal>
      </div>
  )
}

export default StudentList
