import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useHistory, useParams } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Descriptions, Empty, Input, message,
  Modal, Pagination, Result, Skeleton, Table, Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined,
} from '@ant-design/icons'
import {
  addStudentsToClass, clearAvailableStudents, clearClassDetail, clearClassStudents,
  fetchAvailableStudents, fetchClassDetail, fetchClassStudents,
  removeStudentFromClass, removeStudentsFromClass, setSelectedAvailableStudentIds,
} from 'redux/actions/Class'
import {
  buildDisplayedStudentRecords, buildStudentOrder, formatStudentDate, formatStudentDateTime,
  formatStudentSex, getPageScopedSelectionChange, getSelectionAdjustedPagination, getStudentSortOrder,
} from '../../student/studentUtils'
import '../Class.css'

const { Search } = Input
const STUDENT_COLUMNS = 'id,code,fullname,dob,sex,email,username'

const getErrorMessage = error => (
  error?.message || error?.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.'
)

const isPositiveId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0

const normalizeSelectedStudentKey = value => {
  if (value === null || value === undefined) return null
  const key = String(value)
  if (/^[1-9]\d*$/.test(key)) {
    const id = Number(key)
    return Number.isSafeInteger(id) ? key : null
  }
  return null
}

const ClassDetail = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const { id: routeId } = useParams()
  const classId = Number(routeId)
  const validId = isPositiveId(routeId)
  const detail = useSelector(state => state.classroom.detail)
  const detailLoading = useSelector(state => state.classroom.detailLoading)
  const detailError = useSelector(state => state.classroom.detailError)
  const classStudents = useSelector(state => state.classroom.classStudents)
  const classStudentsPageInfo = useSelector(state => state.classroom.classStudentsPageInfo)
  const classStudentsLoading = useSelector(state => state.classroom.classStudentsLoading)
  const classStudentsError = useSelector(state => state.classroom.classStudentsError)
  const availableApiRecords = useSelector(state => state.classroom.availableStudents)
  const availableStudentsPageInfo = useSelector(state => state.classroom.availableStudentsPageInfo)
  const availableStudentsLoading = useSelector(state => state.classroom.availableStudentsLoading)
  const availableStudentsError = useSelector(state => state.classroom.availableStudentsError)
  const selectedAvailableStudentIds = useSelector(state => state.classroom.selectedAvailableStudentIds)
  const selectedAvailableStudentsById = useSelector(state => state.classroom.selectedAvailableStudentsById)
  const addStudentsLoading = useSelector(state => state.classroom.addStudentsLoading)
  const removingStudentId = useSelector(state => state.classroom.removingStudentId)
  const removeStudentsLoading = useSelector(state => state.classroom.removeStudentsLoading)

  const [studentsQuery, setStudentsQuery] = useState({ page: 1, size: 10, search: '', order: '' })
  const [studentsSearch, setStudentsSearch] = useState('')
  const [availableQuery, setAvailableQuery] = useState({ page: 1, size: 10, search: '', order: '' })
  const [availableSearch, setAvailableSearch] = useState('')
  const [availableVisible, setAvailableVisible] = useState(false)
  const [selectedClassStudentIds, setSelectedClassStudentIds] = useState([])
  const [selectedClassStudentsById, setSelectedClassStudentsById] = useState({})

  const updateClassStudentSelection = (keys, records = []) => {
    const ids = Array.from(new Set((Array.isArray(keys) ? keys : [])
      .map(normalizeSelectedStudentKey)
      .filter(id => id !== null)))
    setSelectedClassStudentIds(ids)
    setSelectedClassStudentsById(current => {
      const nextRecordsById = {}
      ids.forEach(id => {
        if (current[id]) nextRecordsById[id] = current[id]
      })
      records.forEach(record => {
        const id = normalizeSelectedStudentKey(record?.id)
        if (id !== null && ids.includes(id)) nextRecordsById[id] = record
      })
      return nextRecordsById
    })
  }

  const updateAvailableSelection = (keys, records = []) => {
    const ids = Array.from(new Set((Array.isArray(keys) ? keys : [])
      .map(normalizeSelectedStudentKey)
      .filter(id => id !== null)))
    const nextRecordsById = {}
    ids.forEach(id => {
      if (selectedAvailableStudentsById?.[id]) nextRecordsById[id] = selectedAvailableStudentsById[id]
    })
    records.forEach(record => {
      const id = normalizeSelectedStudentKey(record?.id)
      if (id !== null && ids.includes(id)) nextRecordsById[id] = record
    })
    dispatch(setSelectedAvailableStudentIds(ids, nextRecordsById))
  }

  const listRoute = '/app/class/list'
  const loadClassStudents = (nextQuery = studentsQuery) => dispatch(fetchClassStudents(classId, {
    ...nextQuery,
    search: nextQuery.search || undefined,
    order: nextQuery.order || undefined,
    columnlist: STUDENT_COLUMNS,
  }))
  const loadAvailableStudents = (nextQuery = availableQuery) => dispatch(fetchAvailableStudents(classId, {
    ...nextQuery,
    search: nextQuery.search || undefined,
    order: nextQuery.order || undefined,
    columnlist: STUDENT_COLUMNS,
  }))

  useEffect(() => {
    dispatch(clearClassDetail())
    dispatch(clearClassStudents())
    dispatch(clearAvailableStudents())
    setSelectedClassStudentIds([])
    setSelectedClassStudentsById({})
    if (validId) {
      dispatch(fetchClassDetail(classId))
      loadClassStudents({ page: 1, size: 10, search: '', order: '' })
    }
    return () => {
      dispatch(clearClassDetail())
      dispatch(clearClassStudents())
      dispatch(clearAvailableStudents())
    }
  }, [classId, dispatch, validId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshDetailAndStudents = (nextQuery = studentsQuery) => {
    dispatch(fetchClassDetail(classId))
    loadClassStudents(nextQuery)
  }

  const handleStudentsSearch = value => {
    const search = typeof value === 'string' ? value.trim() : ''
    setStudentsSearch(search)
    if (search === studentsQuery.search && studentsQuery.page === 1) return
    const nextQuery = { ...studentsQuery, page: 1, search }
    setStudentsQuery(nextQuery)
    loadClassStudents(nextQuery)
  }

  const handleStudentsPageChange = (page, size) => {
    const nextQuery = { ...studentsQuery, page: size !== studentsQuery.size ? 1 : page, size }
    setStudentsQuery(nextQuery)
    loadClassStudents(nextQuery)
  }

  const handleStudentsTableChange = (_, __, sorter) => {
    const order = buildStudentOrder(sorter)
    if (order === studentsQuery.order) return
    const nextQuery = { ...studentsQuery, page: 1, order }
    setStudentsQuery(nextQuery)
    loadClassStudents(nextQuery)
  }

  const handleClassStudentRowSelect = (record, selected) => {
    const recordId = normalizeSelectedStudentKey(record?.id)
    if (recordId === null) return
    updateClassStudentSelection(
      selected
        ? [...selectedClassStudentIds, recordId]
        : selectedClassStudentIds.filter(id => id !== recordId),
      selected ? [record] : []
    )
  }

  const handleClassStudentSelectAll = (selected, _, changeRows) => {
    const change = getPageScopedSelectionChange({
      apiRecords: classStudents,
      changeRows,
      selected,
      selectedRowKeys: selectedClassStudentIds,
      getRecordKey: record => normalizeSelectedStudentKey(record?.id),
    })
    updateClassStudentSelection(change.keys, change.records)
  }

  const openAvailableStudents = () => {
    const nextQuery = { page: 1, size: 10, search: '', order: '' }
    setAvailableQuery(nextQuery)
    setAvailableSearch('')
    dispatch(setSelectedAvailableStudentIds([], {}))
    setAvailableVisible(true)
    loadAvailableStudents(nextQuery)
  }

  const closeAvailableStudents = () => {
    if (addStudentsLoading) return
    setAvailableVisible(false)
    setAvailableSearch('')
    setAvailableQuery({ page: 1, size: 10, search: '', order: '' })
    dispatch(clearAvailableStudents())
  }

  const handleAvailableSearch = value => {
    const search = typeof value === 'string' ? value.trim() : ''
    setAvailableSearch(search)
    if (search === availableQuery.search && availableQuery.page === 1) return
    const nextQuery = { ...availableQuery, page: 1, search }
    setAvailableQuery(nextQuery)
    loadAvailableStudents(nextQuery)
  }

  const handleAvailablePageChange = (page, size) => {
    const nextQuery = { ...availableQuery, page: size !== availableQuery.size ? 1 : page, size }
    setAvailableQuery(nextQuery)
    loadAvailableStudents(nextQuery)
  }

  const handleAvailableTableChange = (_, __, sorter) => {
    const order = buildStudentOrder(sorter)
    if (order === availableQuery.order) return
    const nextQuery = { ...availableQuery, page: 1, order }
    setAvailableQuery(nextQuery)
    loadAvailableStudents(nextQuery)
  }

  const handleAvailableRowSelect = (record, selected) => {
    const recordId = normalizeSelectedStudentKey(record?.id)
    if (recordId === null) return
    const keys = selected
      ? [...selectedAvailableStudentIds, recordId]
      : selectedAvailableStudentIds.filter(id => String(id) !== recordId)
    updateAvailableSelection(keys, selected ? [record] : [])
  }

  const handleAvailableSelectAll = (selected, _, changeRows) => {
    const change = getPageScopedSelectionChange({
      apiRecords: availableApiRecords,
      changeRows,
      selected,
      selectedRowKeys: selectedAvailableStudentIds,
      getRecordKey: record => String(record.id),
    })
    updateAvailableSelection(change.keys, change.records)
  }

  const displayedAvailableStudents = useMemo(() => buildDisplayedStudentRecords(
    availableApiRecords,
    selectedAvailableStudentIds,
    selectedAvailableStudentsById,
    record => String(record.id),
    record => ['code', 'fullname', 'email', 'username', 'description'].some(field => (
      String(record?.[field] || '').toLocaleLowerCase('vi').includes(availableQuery.search.toLocaleLowerCase('vi'))
    ))
  ), [availableApiRecords, availableQuery.search, selectedAvailableStudentIds, selectedAvailableStudentsById])
  const availablePagination = getSelectionAdjustedPagination({
    totalItems: availableStudentsPageInfo.total_items,
    pageSize: availableQuery.size,
    currentPage: availableQuery.page,
    selectedRowKeys: selectedAvailableStudentIds,
    selectedRecordsById: selectedAvailableStudentsById,
    matchesRecord: record => {
      const keyword = availableQuery.search.trim().toLocaleLowerCase('vi')
      return !keyword || ['code', 'fullname', 'email', 'username', 'description'].some(field => (
        String(record?.[field] || '').toLocaleLowerCase('vi').includes(keyword)
      ))
    },
  })

  useEffect(() => {
    if (!availableVisible || availableStudentsLoading || Number(availableStudentsPageInfo.current) !== availableQuery.page || availableQuery.page === availablePagination.currentPage) return
    const nextQuery = { ...availableQuery, page: availablePagination.currentPage }
    setAvailableQuery(nextQuery)
    loadAvailableStudents(nextQuery)
  }, [availablePagination.currentPage, availableQuery, availableStudentsLoading, availableStudentsPageInfo.current, availableVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitAvailableStudents = () => {
    if (!selectedAvailableStudentIds.length || addStudentsLoading) return
    const studentIds = Array.from(new Set(selectedAvailableStudentIds
      .map(Number)
      .filter(id => Number.isSafeInteger(id) && id > 0)))
    if (!studentIds.length) return
    dispatch(addStudentsToClass(
      classId,
      studentIds,
      data => {
        const count = Array.isArray(data?.studentIds) ? data.studentIds.length : studentIds.length
        message.success(`Đã thêm ${count} sinh viên vào lớp`)
        closeAvailableStudents()
        refreshDetailAndStudents({ ...studentsQuery, page: 1 })
      },
      error => message.error(getErrorMessage(error))
    ))
  }

  const removeStudent = record => new Promise((resolve, reject) => {
    dispatch(removeStudentFromClass(
      classId,
      record.id,
      () => {
        const totalAfterRemoval = Math.max(0, Number(classStudentsPageInfo.total_items || 0) - 1)
        const lastPage = Math.max(1, Math.ceil(totalAfterRemoval / studentsQuery.size))
        const nextQuery = { ...studentsQuery, page: Math.min(studentsQuery.page, lastPage) }
        setStudentsQuery(nextQuery)
        updateClassStudentSelection(selectedClassStudentIds.filter(id => id !== normalizeSelectedStudentKey(record.id)))
        refreshDetailAndStudents(nextQuery)
        message.success('Đã loại sinh viên khỏi lớp')
        resolve()
      },
      error => {
        message.error(getErrorMessage(error))
        loadClassStudents()
        reject(error)
      }
    ))
  })

  const removeSelectedStudents = studentIds => new Promise((resolve, reject) => {
    dispatch(removeStudentsFromClass(
      classId,
      studentIds,
      data => {
        const removedIds = Array.isArray(data?.studentIds) ? data.studentIds : studentIds
        const totalAfterRemoval = Math.max(0, Number(classStudentsPageInfo.total_items || 0) - removedIds.length)
        const lastPage = Math.max(1, Math.ceil(totalAfterRemoval / studentsQuery.size))
        const nextQuery = { ...studentsQuery, page: Math.min(studentsQuery.page, lastPage) }
        setStudentsQuery(nextQuery)
        updateClassStudentSelection([])
        refreshDetailAndStudents(nextQuery)
        message.success(`Đã loại ${removedIds.length} sinh viên khỏi lớp`)
        resolve()
      },
      error => {
        message.error(getErrorMessage(error))
        loadClassStudents()
        reject(error)
      }
    ))
  })

  const confirmRemoveStudent = record => {
    Modal.confirm({
      title: 'Xác nhận loại sinh viên khỏi lớp',
      content: `Bạn có chắc chắn muốn loại sinh viên “${record.fullname || '-'}” khỏi lớp “${detail?.name || '-'}” không?`,
      okText: 'Loại khỏi lớp',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => removeStudent(record),
    })
  }

  const confirmRemoveSelectedStudents = () => {
    const studentIds = selectedClassStudentIds.map(Number)
      .filter(id => Number.isSafeInteger(id) && id > 0)
    if (!studentIds.length || removeStudentsLoading || removingStudentId !== null) return
    const selectedRecord = selectedClassStudentsById[selectedClassStudentIds[0]]
    const content = studentIds.length === 1
      ? `Bạn có chắc chắn muốn loại sinh viên “${selectedRecord?.code || '-'} - ${selectedRecord?.fullname || '-'}” khỏi lớp này không?`
      : `Bạn có chắc chắn muốn loại ${studentIds.length} sinh viên khỏi lớp này không?`
    Modal.confirm({
      title: 'Xác nhận loại sinh viên khỏi lớp',
      content,
      okText: 'Loại khỏi lớp',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => removeSelectedStudents(studentIds),
    })
  }

  const studentColumns = useMemo(() => [
    { key: 'code', dataIndex: 'code', title: 'Mã sinh viên', sorter: true, sortOrder: getStudentSortOrder(studentsQuery.order, 'code'), width: 140 },
    { key: 'fullname', dataIndex: 'fullname', title: 'Họ tên', sorter: true, sortOrder: getStudentSortOrder(studentsQuery.order, 'fullname'), width: 190 },
    { key: 'dob', dataIndex: 'dob', title: 'Ngày sinh', width: 120, render: formatStudentDate },
    { key: 'sex', dataIndex: 'sex', title: 'Giới tính', width: 100, render: formatStudentSex },
    { key: 'email', dataIndex: 'email', title: 'Email', width: 220, render: value => value || '-' },
    { key: 'username', dataIndex: 'username', title: 'Tên đăng nhập', width: 160, render: value => value || '-' },
    {
      key: 'action', title: 'Hành động', fixed: 'right', align: 'right', width: 150,
      render: (_, record) => (
        <Tooltip title="Loại khỏi lớp">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={removingStudentId === record.id}
            disabled={removingStudentId !== null || removeStudentsLoading}
            onClick={event => { event.stopPropagation(); confirmRemoveStudent(record) }}
          >
            Loại khỏi lớp
          </Button>
        </Tooltip>
      ),
    },
  ], [removeStudentsLoading, removingStudentId, studentsQuery.order]) // eslint-disable-line react-hooks/exhaustive-deps

  const availableColumns = useMemo(() => [
    { key: 'code', dataIndex: 'code', title: 'Mã sinh viên', sorter: true, sortOrder: getStudentSortOrder(availableQuery.order, 'code'), width: 140 },
    { key: 'fullname', dataIndex: 'fullname', title: 'Họ tên', sorter: true, sortOrder: getStudentSortOrder(availableQuery.order, 'fullname'), width: 190 },
    { key: 'dob', dataIndex: 'dob', title: 'Ngày sinh', width: 120, render: formatStudentDate },
    { key: 'sex', dataIndex: 'sex', title: 'Giới tính', width: 100, render: formatStudentSex },
    { key: 'email', dataIndex: 'email', title: 'Email', width: 220, render: value => value || '-' },
    { key: 'username', dataIndex: 'username', title: 'Tên đăng nhập', width: 160, render: value => value || '-' },
  ], [availableQuery.order])

  if (!validId) {
    return <Result status="warning" title="ID lớp không hợp lệ" extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>} />
  }
  if (detailError) {
    return <Result status={Number(detailError.status) === 404 ? 'warning' : 'error'} title={detailError.message || 'Không thể tải dữ liệu lớp'} extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>} />
  }
  if (detailLoading || Number(detail?.id) !== classId) {
    return <Card className="class-detail-card"><Skeleton active paragraph={{ rows: 7 }} /></Card>
  }

  return (
    <div className="class-detail-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Lớp</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Chi tiết Lớp</Breadcrumb.Item>
      </Breadcrumb>
      <div className="class-list-toolbar">
        <h1>Chi tiết Lớp</h1>
        <div className="class-list-toolbar-actions">
          <Button icon={<ArrowLeftOutlined />} onClick={() => history.push(listRoute)}>Quay lại</Button>
          <Button icon={<EditOutlined />} onClick={() => history.push(`/app/class/edit/${classId}`)}>Chỉnh sửa</Button>
        </div>
      </div>

      <Card className="class-detail-card mb-4">
        <Descriptions bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Mã lớp">{detail.code || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên lớp">{detail.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Số sinh viên">{Number(detail.student_count || 0)}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{formatStudentDateTime(detail.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Mô tả" span={2}>{detail.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ngày cập nhật" span={2}>{formatStudentDateTime(detail.updated_at)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Sinh viên thuộc lớp" bodyStyle={{ padding: 0 }}>
        <div className="class-detail-table-toolbar">
          <Search
            value={studentsSearch}
            allowClear
            enterButton
            placeholder="Tìm mã, họ tên, email hoặc tài khoản..."
            onChange={event => {
              const value = event.target.value
              setStudentsSearch(value)
              if (!value && studentsQuery.search) handleStudentsSearch('')
            }}
            onSearch={handleStudentsSearch}
          />
          <Tooltip title="Thêm sinh viên">
            <Button
              type="primary"
              shape="circle"
              icon={<PlusOutlined />}
              aria-label="Thêm sinh viên"
              onClick={openAvailableStudents}
            />
          </Tooltip>
          <Button
            danger
            disabled={!selectedClassStudentIds.length || removeStudentsLoading || removingStudentId !== null}
            loading={removeStudentsLoading}
            onClick={confirmRemoveSelectedStudents}
          >
            Loại khỏi lớp
          </Button>
        </div>
        {selectedClassStudentIds.length > 0 && (
          <div className="class-selection-summary">
            Đã chọn {selectedClassStudentIds.length} sinh viên
            <Button type="link" onClick={() => updateClassStudentSelection([])}>Bỏ chọn tất cả</Button>
          </div>
        )}
        {classStudentsError && <Alert className="m-3" type="error" showIcon message={classStudentsError} />}
        <Table
          rowKey={record => normalizeSelectedStudentKey(record?.id) || String(record?.id || '')}
          columns={studentColumns}
          dataSource={classStudents}
          rowSelection={{
            selectedRowKeys: selectedClassStudentIds,
            preserveSelectedRowKeys: true,
            onSelect: handleClassStudentRowSelect,
            onSelectAll: handleClassStudentSelectAll,
          }}
          loading={classStudentsLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          onChange={handleStudentsTableChange}
          locale={{ emptyText: <Empty description={studentsQuery.search ? 'Không tìm thấy sinh viên phù hợp' : 'Lớp chưa có sinh viên'} /> }}
        />
        <div className="class-list-pagination">
          <Pagination
            current={Number(classStudentsPageInfo.current) || studentsQuery.page}
            pageSize={Number(classStudentsPageInfo.size) || studentsQuery.size}
            total={Number(classStudentsPageInfo.total_items) || 0}
            showSizeChanger
            onChange={handleStudentsPageChange}
          />
        </div>
      </Card>

      <Modal
        visible={availableVisible}
        width={1100}
        title="Thêm sinh viên vào lớp"
        okText="Thêm vào lớp"
        cancelText="Hủy"
        okButtonProps={{ disabled: !selectedAvailableStudentIds.length }}
        confirmLoading={addStudentsLoading}
        closable={!addStudentsLoading}
        maskClosable={!addStudentsLoading}
        onCancel={closeAvailableStudents}
        onOk={submitAvailableStudents}
        destroyOnClose
      >
        <div className="class-detail-modal-toolbar">
          <Search
            value={availableSearch}
            allowClear
            enterButton
            placeholder="Tìm mã, họ tên, email hoặc tài khoản..."
            onChange={event => {
              const value = event.target.value
              setAvailableSearch(value)
              if (!value && availableQuery.search) handleAvailableSearch('')
            }}
            onSearch={handleAvailableSearch}
          />
          <span>Đã chọn: {selectedAvailableStudentIds.length} sinh viên</span>
          <Button type="link" disabled={!selectedAvailableStudentIds.length} onClick={() => dispatch(setSelectedAvailableStudentIds([], {}))}>Bỏ chọn tất cả</Button>
        </div>
        {availableStudentsError && <Alert className="mb-3" type="error" showIcon message={availableStudentsError} />}
        <Table
          rowKey={(record) => String(record.id)}
          columns={availableColumns}
          dataSource={displayedAvailableStudents}
          loading={availableStudentsLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          onChange={handleAvailableTableChange}
          rowSelection={{
            selectedRowKeys: selectedAvailableStudentIds,
            preserveSelectedRowKeys: true,
            onSelect: handleAvailableRowSelect,
            onSelectAll: handleAvailableSelectAll,
          }}
          locale={{ emptyText: <Empty description={availableQuery.search ? 'Không tìm thấy sinh viên phù hợp' : 'Không có sinh viên có thể thêm'} /> }}
        />
        <div className="class-list-pagination">
          <Pagination
            current={availablePagination.currentPage}
            pageSize={availableQuery.size}
            total={availablePagination.totalItems}
            showSizeChanger
            onChange={handleAvailablePageChange}
          />
        </div>
      </Modal>
    </div>
  )
}

export default ClassDetail
