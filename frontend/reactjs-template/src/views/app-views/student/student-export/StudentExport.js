import React, { useEffect, useMemo, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Checkbox, Dropdown, Empty, Menu,
  message, Popover, Select, Spin, Table
} from 'antd'
import {
  ArrowLeftOutlined, DownloadOutlined, FilterOutlined, PrinterOutlined
} from '@ant-design/icons'
import ClassService from 'services/ClassService'
import StudentService from 'services/StudentService'
import downloadBlob, {
  getBlobErrorMessage, getDownloadFilename
} from 'utils/downloadBlob'
import {
  formatStudentDate as formatDate, formatStudentSex as formatSex,
  unwrapCollection
} from '../studentUtils'
import './StudentExport.css'

const { Option } = Select

const DEFAULT_COLUMNS = ['code', 'fullname', 'dob', 'sex', 'class', 'homecity', 'address', 'email']

const unwrapStudent = response => {
  const payload = response?.data || response
  return payload?.data || payload
}

const getClassLabel = (record, classMap) => {
  const joinedClass = record?.class || record?.class_info
  const joinedName = joinedClass?.name || joinedClass?.class_name || joinedClass?.className || joinedClass?.code
  if (joinedName) return joinedName
  if (record?.class_id === null || record?.class_id === undefined) return 'Chưa xếp lớp'
  return classMap[record.class_id] || `Lớp #${record.class_id}`
}

const StudentExport = () => {
  const history = useHistory()
  const location = useLocation()
  const listState = location.state?.studentListState
  const selectedRowKeys = useMemo(() => (
    Array.isArray(listState?.selectedRowKeys) ? listState.selectedRowKeys : []
  ), [listState])
  const [template, setTemplate] = useState('default-grid')
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS)
  const [columnChooserVisible, setColumnChooserVisible] = useState(false)
  const [previewRows, setPreviewRows] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [classMap, setClassMap] = useState({})
  const [exportingType, setExportingType] = useState(null)

  const listRoute = {
    pathname: '/app/student/list',
    state: listState ? { studentListState: listState } : undefined,
  }

  useEffect(() => {
    let active = true
    ClassService.getAll()
      .then(response => {
        if (!active) return
        const classes = unwrapCollection(response)
        setClassMap(classes.reduce((map, item) => ({
          ...map,
          [item.id]: item.name || item.class_name || item.className || item.code || item.id,
        }), {}))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!selectedRowKeys.length) {
      setPreviewRows([])
      setPreviewError('')
      setPreviewLoading(false)
      return () => { active = false }
    }

    setPreviewLoading(true)
    setPreviewError('')
    Promise.allSettled(selectedRowKeys.map(id => StudentService.getById(id)))
      .then(results => {
        if (!active) return
        const rowsById = new Map()
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') return
          const student = unwrapStudent(result.value)
          if (student && typeof student === 'object') rowsById.set(selectedRowKeys[index], student)
        })
        const rows = selectedRowKeys.map(id => rowsById.get(id)).filter(Boolean)
        setPreviewRows(rows)
        if (!rows.length) setPreviewError('Không tải được dữ liệu của các sinh viên đã chọn.')
      })
      .catch(() => {
        if (active) setPreviewError('Không tải được dữ liệu preview.')
      })
      .finally(() => { if (active) setPreviewLoading(false) })

    return () => { active = false }
  }, [selectedRowKeys])

  const availableColumns = useMemo(() => [
    { key: 'code', title: 'Mã học sinh', dataIndex: 'code', render: value => value || '-' },
    { key: 'fullname', title: 'Họ và tên', dataIndex: 'fullname', render: value => value || '-' },
    { key: 'dob', title: 'Ngày sinh', dataIndex: 'dob', render: formatDate },
    { key: 'sex', title: 'Giới tính', dataIndex: 'sex', render: formatSex },
    { key: 'class', title: 'Lớp', render: (_, record) => getClassLabel(record, classMap) },
    { key: 'homecity', title: 'Quê quán', dataIndex: 'homecity', render: value => value || '-' },
    { key: 'address', title: 'Địa chỉ', dataIndex: 'address', render: value => value || '-' },
    { key: 'email', title: 'Email', dataIndex: 'email', render: value => value || '-' },
  ], [classMap])

  const previewColumns = useMemo(() => availableColumns
    .filter(column => visibleColumns.includes(column.key))
    .map(column => ({
      title: column.title,
      dataIndex: column.dataIndex,
      key: column.key,
      render: column.render,
      ellipsis: true,
    })), [availableColumns, visibleColumns])

  const handleColumnChange = keys => setVisibleColumns(keys)

  const handleExport = async type => {
    if (exportingType) return
    if (!selectedRowKeys.length) {
      message.warning('Vui lòng chọn ít nhất một sinh viên trước khi xuất dữ liệu.')
      return
    }
    if (!visibleColumns.length) {
      message.warning('Vui lòng chọn ít nhất một cột dữ liệu.')
      return
    }

    setExportingType(type)
    try {
      const response = await StudentService.massExport(selectedRowKeys, type)
      const blob = response?.data
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Máy chủ không trả về file dữ liệu hợp lệ.')
      }
      const filename = getDownloadFilename(
        response?.headers?.['content-disposition'],
        `students-export.${type}`
      )
      downloadBlob(blob, filename)
      message.success('Đã bắt đầu tải file xuất dữ liệu.')
    } catch (error) {
      message.error(await getBlobErrorMessage(
        error,
        'Không thể xuất dữ liệu. Vui lòng thử lại.'
      ))
    } finally {
      setExportingType(null)
    }
  }

  const exportMenu = (
    <Menu>
      <Menu.Item key="csv" disabled={Boolean(exportingType)} onClick={() => handleExport('csv')}>CSV</Menu.Item>
      <Menu.Item key="xlsx" disabled={Boolean(exportingType)} onClick={() => handleExport('xlsx')}>Excel</Menu.Item>
      <Menu.Item key="json" disabled={Boolean(exportingType)} onClick={() => handleExport('json')}>JSON</Menu.Item>
      <Menu.Item key="xml" disabled={Boolean(exportingType)} onClick={() => handleExport('xml')}>XML</Menu.Item>
    </Menu>
  )

  const columnChooser = (
    <div className="student-export-column-chooser" onClick={event => event.stopPropagation()}>
      <Checkbox.Group value={visibleColumns} onChange={handleColumnChange} className="student-export-column-list">
        {availableColumns.map(column => (
          <Checkbox key={column.key} value={column.key}>{column.title}</Checkbox>
        ))}
      </Checkbox.Group>
    </div>
  )

  return (
    <div className="student-export-page">
      <div className="student-export-actions no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={() => history.push(listRoute)}>Trở về Danh sách Sinh viên</Button>
        <div className="student-export-actions-right">
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In mẫu</Button>
          <Dropdown overlay={exportMenu} trigger={['click']} disabled={Boolean(exportingType)}>
            <Button type="primary" icon={<DownloadOutlined />} loading={Boolean(exportingType)}>Xuất dữ liệu</Button>
          </Dropdown>
        </div>
      </div>

      <Breadcrumb className="student-export-breadcrumb no-print">
        <Breadcrumb.Item>Quản lý danh mục</Breadcrumb.Item>
        <Breadcrumb.Item>Sinh viên</Breadcrumb.Item>
        <Breadcrumb.Item>Xuất dữ liệu</Breadcrumb.Item>
      </Breadcrumb>

      <div className="student-export-print-area">
        <h2>Xuất dữ liệu theo mẫu</h2>
        <Card className="student-export-config no-print">
          <div className="student-export-config-row">
            <div>
              <label htmlFor="student-export-template">Chọn mẫu xuất dữ liệu</label>
              <Select id="student-export-template" className="student-export-template-select" value={template} onChange={setTemplate}>
                <Option value="default-grid">Mẫu mặc định theo lưới dữ liệu</Option>
              </Select>
            </div>
            <div className="student-export-column-control">
              <span>Chọn cột hiển thị</span>
              <Popover
                content={columnChooser}
                trigger="click"
                placement="bottomRight"
                visible={columnChooserVisible}
                onVisibleChange={setColumnChooserVisible}
                destroyTooltipOnHide={false}
                overlayClassName="student-export-column-popover"
              >
                <Button aria-label="Chọn cột hiển thị" icon={<FilterOutlined />}>Chọn cột</Button>
              </Popover>
            </div>
          </div>
          {!visibleColumns.length && <Alert className="mt-3" type="warning" showIcon message="Vui lòng chọn ít nhất một cột dữ liệu." />}
        </Card>

        <Card className="student-export-preview" title="Preview dữ liệu đã chọn">
          {!selectedRowKeys.length && (
            <Alert type="warning" showIcon message="Vui lòng chọn sinh viên từ Danh sách Sinh viên trước khi xuất dữ liệu." />
          )}
          {selectedRowKeys.length > 0 && previewLoading && <div className="student-export-loading"><Spin tip="Đang tải preview..." /></div>}
          {selectedRowKeys.length > 0 && !previewLoading && previewError && <Alert type="error" showIcon message={previewError} />}
          {selectedRowKeys.length > 0 && !previewLoading && !previewError && !previewRows.length && <Empty description="Không có dữ liệu để preview" />}
          {selectedRowKeys.length > 0 && !previewLoading && previewRows.length > 0 && (
            <Table rowKey="id" columns={previewColumns} dataSource={previewRows} pagination={false} scroll={{ x: 'max-content' }} />
          )}
        </Card>
      </div>
    </div>
  )
}

export default StudentExport
