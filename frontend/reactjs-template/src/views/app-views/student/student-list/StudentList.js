import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router-dom'
import {
  Card, Table, Tag, Tooltip, Button, Input, Popconfirm,
  Popover, Checkbox, Dropdown, Menu, message
} from 'antd'
import {
  EyeOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  CopyOutlined,
  FilterOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import moment from 'moment'
import ClassService from 'services/ClassService'
import StudentService from 'services/StudentService'
import downloadBlob from 'utils/downloadBlob'
import {
  fetchStudentList,
  deleteStudent
} from 'redux/actions/Student'

const { Search } = Input

const ALL_COLUMN_KEYS = ['student', 'code', 'dob', 'sex', 'class', 'email', 'action']
const COLUMN_LABELS = {
  student: 'Sinh viên',
  code: 'Mã SV',
  dob: 'Ngày sinh',
  sex: 'Giới tính',
  class: 'Lớp',
  email: 'Email',
  action: 'Hành động'
}

const StudentList = () => {
  const dispatch = useDispatch()
  const history = useHistory()

  // Redux state
  const list = useSelector(state => state.student.list)
  const pageInfo = useSelector(state => state.student.pageInfo)
  const listLoading = useSelector(state => state.student.listLoading)

  // Local state
  const [classMap, setClassMap] = useState({})
  const [searchValue, setSearchValue] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMN_KEYS)

  // On mount: fetch student list + load classMap
  useEffect(() => {
    dispatch(fetchStudentList({ page: 1, size: 10 }))

    ClassService.getAll()
      .then(res => {
        const map = {}
        const records = res?.records || res?.data || res || []
        if (Array.isArray(records)) {
          records.forEach(cls => {
            map[cls.id] = cls.name || cls.class_name || cls.className || cls.id
          })
        }
        setClassMap(map)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleSearch = value => {
    setSearchValue(value)
    dispatch(fetchStudentList({ page: 1, size: pageInfo.size || 10, search: value }))
  }

  const handleDelete = id => {
    dispatch(deleteStudent(id))
  }

  const handleCopyOne = async (id) => {
    try {
      await StudentService.copyOne(id)
      message.success('Sao chép sinh viên thành công')
      dispatch(fetchStudentList({ page: pageInfo.current, size: pageInfo.size, search: searchValue }))
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi sao chép sinh viên')
    }
  }

  const renderClassName = classId => {
    if (!classId || !classMap[classId]) {
      return <Tag color="default">Chưa xếp lớp</Tag>
    }
    return classMap[classId]
  }

  const renderGender = sex => {
    if (sex === true) return 'Nam'
    if (sex === false) return 'Nữ'
    return '-'
  }

  // ─── Column definitions ──────────────────────────────────
  const columns = [
    {
      title: 'Họ và tên',
      dataIndex: 'fullname',
      key: 'student'
    },
    {
      title: 'Mã SV',
      dataIndex: 'code',
      key: 'code'
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'dob',
      key: 'dob',
      render: dob => dob ? moment(dob).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Giới tính',
      dataIndex: 'sex',
      key: 'sex',
      render: sex => renderGender(sex)
    },
    {
      title: 'Lớp',
      dataIndex: 'class_id',
      key: 'class',
      render: classId => renderClassName(classId)
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <div className="text-right d-flex justify-content-end align-items-center">
          <Tooltip title="Xem chi tiết">
            <Button type="text" icon={<EyeOutlined />} size="small" onClick={() => history.push(`/app/student/detail/${record.id}`)} />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" icon={<EditOutlined />} size="small" onClick={() => history.push(`/app/student/edit/${record.id}`)} />
          </Tooltip>
          <Popconfirm title="Xác nhận xóa sinh viên này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
            <Tooltip title="Xóa">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
          <Dropdown overlay={
            <Menu>
              <Menu.Item key="copy" icon={<CopyOutlined />} onClick={() => handleCopyOne(record.id)}>
                Sao chép
              </Menu.Item>
            </Menu>
          } trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        </div>
      )
    }
  ]

  const filteredColumns = columns.filter(col => visibleColumns.includes(col.key))

  // ─── Column filter popover ──────────────────────────────
  const filterContent = (
    <Checkbox.Group
      value={visibleColumns}
      onChange={setVisibleColumns}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {ALL_COLUMN_KEYS.filter(k => k !== 'action').map(key => (
        <Checkbox key={key} value={key}>{COLUMN_LABELS[key]}</Checkbox>
      ))}
    </Checkbox.Group>
  )

  // ─── Bulk actions ───────────────────────────────────────
  const hasSelection = selectedRowKeys.length > 0

  const handleBulkExport = async (type) => {
    try {
      const ids = hasSelection ? selectedRowKeys : list.map(s => s.id)
      const blob = await StudentService.massExport(ids, type)
      downloadBlob(blob, `students-export.${type}`)
    } catch (err) {
      message.error('Lỗi xuất dữ liệu')
    }
  }

  const handleBulkCopy = async () => {
    try {
      await StudentService.massCopy(selectedRowKeys)
      message.success('Sao chép thành công')
      setSelectedRowKeys([])
      dispatch(fetchStudentList({ page: 1, size: pageInfo.size, search: searchValue }))
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi sao chép')
    }
  }

  const handleBulkDelete = async () => {
    try {
      await StudentService.massDestroy(selectedRowKeys)
      message.success('Xóa thành công')
      setSelectedRowKeys([])
      dispatch(fetchStudentList({ page: 1, size: pageInfo.size, search: searchValue }))
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi xóa')
    }
  }

  const bulkActionMenu = (
    <Menu>
      <Menu.Item key="import" icon={<UploadOutlined />} onClick={() => message.info('Chức năng Nhập dữ liệu sẽ hoàn thiện ở bước sau')}>
        Nhập dữ liệu từ file
      </Menu.Item>
      <Menu.SubMenu key="export" icon={<DownloadOutlined />} title="Xuất dữ liệu theo mẫu">
        <Menu.Item key="export-csv" onClick={() => handleBulkExport('csv')}>CSV</Menu.Item>
        <Menu.Item key="export-xlsx" onClick={() => handleBulkExport('xlsx')}>Excel</Menu.Item>
        <Menu.Item key="export-json" onClick={() => handleBulkExport('json')}>JSON</Menu.Item>
        <Menu.Item key="export-xml" onClick={() => handleBulkExport('xml')}>XML</Menu.Item>
      </Menu.SubMenu>
      <Menu.Item key="copy" icon={<CopyOutlined />} disabled={!hasSelection} onClick={handleBulkCopy}>
        Sao chép dữ liệu đã chọn
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger disabled={!hasSelection} onClick={handleBulkDelete}>
        Xóa dữ liệu đã chọn
      </Menu.Item>
    </Menu>
  )

  // ─── Row selection config ───────────────────────────────
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <h2 className="mb-0">Danh sách Sinh viên</h2>
        <div className="d-flex align-items-center" style={{ gap: 8 }}>
          <Dropdown overlay={bulkActionMenu} trigger={['click']}>
            <Button>Hành động <MoreOutlined /></Button>
          </Dropdown>
          <Popover content={filterContent} title="Hiện cột" trigger="click" placement="bottomRight">
            <Button icon={<FilterOutlined />}>Bộ lọc</Button>
          </Popover>
          <Search
            placeholder="Tìm kiếm sinh viên..."
            onSearch={handleSearch}
            onChange={e => !e.target.value && handleSearch('')}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={() => history.push('/app/student/create')} />
        </div>
      </div>

      {/* Table card */}
      <Card bodyStyle={{ padding: '0px' }}>
        <div className="table-responsive">
          <Table
            columns={filteredColumns}
            dataSource={list}
            rowKey="id"
            loading={listLoading}
            rowSelection={rowSelection}
            pagination={{
              current: pageInfo.current,
              pageSize: pageInfo.size,
              total: pageInfo.total_items,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} sinh viên`,
              onChange: (page, pageSize) =>
                dispatch(fetchStudentList({ page, size: pageSize, search: searchValue }))
            }}
          />
        </div>
      </Card>
    </>
  )
}

export default StudentList
