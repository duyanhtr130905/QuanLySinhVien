import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Col, Descriptions, Empty, Row, Select,
  Table, Tag, Upload, message
} from 'antd'
import {
  DeleteOutlined, DownloadOutlined, FileTextOutlined,
  UploadOutlined
} from '@ant-design/icons'
import ClassService from 'services/ClassService'
import downloadBlob from 'utils/downloadBlob'
import { clearStudentImport, importStudents } from 'redux/actions/Student'
import {
  formatStudentDate as formatDate, formatStudentSex as formatSex,
  unwrapCollection
} from '../studentUtils'
import {
  createImportTemplate, formatFileSize, getFileExtension, IMPORT_FORMATS,
  validateImportFile
} from './studentImportUtils'
import './StudentImport.css'

const { Option } = Select

const getClassLabel = item => {
  const name = item?.name || item?.class_name || item?.className
  if (item?.code && name) return `${item.code} - ${name}`
  return name || item?.code || null
}

const getErrorMessage = error => {
  const payload = error?.data || error || {}
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
  return 'Không thể import dữ liệu. Vui lòng kiểm tra file và thử lại.'
}

const StudentImport = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const importing = useSelector(state => state.student.importLoading)
  const importError = useSelector(state => state.student.importError)
  const storedResult = useSelector(state => state.student.importResult)

  const [templateFormat, setTemplateFormat] = useState('xlsx')
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [classes, setClasses] = useState([])
  const [result, setResult] = useState(null)

  const listRoute = {
    pathname: '/app/student/list',
    state: location.state?.studentListState
      ? { studentListState: location.state.studentListState }
      : undefined,
  }

  useEffect(() => {
    dispatch(clearStudentImport())
    ClassService.getAll().then(response => setClasses(unwrapCollection(response))).catch(() => {})
    return () => dispatch(clearStudentImport())
  }, [dispatch])

  useEffect(() => {
    if (storedResult) setResult(storedResult)
  }, [storedResult])

  const classMap = useMemo(() => classes.reduce((map, item) => ({
    ...map,
    [item.id]: getClassLabel(item) || `Lớp #${item.id}`,
  }), {}), [classes])

  const handleDownloadTemplate = () => {
    try {
      const template = createImportTemplate(templateFormat)
      downloadBlob(template, `student-import-template.${templateFormat}`)
      message.success(`Đã tải mẫu ${templateFormat.toUpperCase()}`)
    } catch (error) {
      message.error(error.message || 'Không thể tạo file mẫu.')
    }
  }

  const chooseFile = file => {
    const validationError = validateImportFile(file)
    if (validationError) {
      setFileError(validationError)
      message.error(validationError)
      return false
    }
    setSelectedFile(file)
    setFileError('')
    setResult(null)
    dispatch(clearStudentImport())
    return false
  }

  const removeFile = () => {
    if (importing) return
    setSelectedFile(null)
    setFileError('')
    setResult(null)
    dispatch(clearStudentImport())
  }

  const handleImport = () => {
    if (importing) return
    const validationError = validateImportFile(selectedFile)
    if (validationError) {
      setFileError(validationError)
      message.error(validationError)
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    dispatch(importStudents(
      formData,
      data => {
        const importResult = data || { created: [], failed: [] }
        const failed = Array.isArray(importResult.failed) ? importResult.failed : []
        const created = Array.isArray(importResult.created) ? importResult.created : []
        setResult({ ...importResult, created, failed })
        if (failed.length) {
          message.warning(`Đã tạo ${created.length} bản ghi, ${failed.length} bản ghi bị lỗi.`)
        } else {
          message.success(`Đã import thành công ${created.length} bản ghi.`)
        }
      },
      error => {
        setFileError(getErrorMessage(error))
      }
    ))
  }

  const createdRecords = Array.isArray(result?.created) ? result.created : []
  const failedRecords = Array.isArray(result?.failed) ? result.failed : []
  const previewColumns = [
    { title: 'Mã sinh viên', dataIndex: 'code', key: 'code', width: 140, render: value => value || '-' },
    { title: 'Họ và tên', dataIndex: 'fullname', key: 'fullname', width: 190, render: value => value || '-' },
    { title: 'Ngày sinh', dataIndex: 'dob', key: 'dob', width: 125, render: formatDate },
    { title: 'Giới tính', dataIndex: 'sex', key: 'sex', width: 110, render: formatSex },
    {
      title: 'Lớp', dataIndex: 'class_id', key: 'class_id', width: 160,
      render: (value, record) => {
        const joined = getClassLabel(record.class || record.class_info)
        if (joined) return joined
        if (value === null || value === undefined || value === '') return <Tag>Chưa xếp lớp</Tag>
        return classMap[value] || `Lớp #${value}`
      }
    },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 230, render: value => value || '-' },
  ]

  const errorColumns = [
    { title: 'Số dòng', dataIndex: 'row', key: 'row', width: 100, render: value => value || '-' },
    {
      title: 'Mã sinh viên / Email', key: 'identifier', width: 250,
      render: record => record.code || record.email || record.student_code || record.student_email || '-'
    },
    { title: 'Lý do lỗi', dataIndex: 'reason', key: 'reason', render: value => value || 'Lỗi không xác định' },
  ]

  return (
    <div className="student-import-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Danh mục Sinh viên</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Import dữ liệu</Breadcrumb.Item>
      </Breadcrumb>

      <div className="student-import-header">
        <div>
          <h1>Import dữ liệu Sinh viên</h1>
          <p>Chọn file dữ liệu theo đúng mẫu để thêm nhiều sinh viên cùng lúc.</p>
        </div>
        <Button onClick={() => history.push(listRoute)}>Trở về danh sách Sinh viên</Button>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={10}>
          <Card title="Xuất mẫu import" className="student-import-card">
            <p className="student-import-note">
              Mẫu gồm các cột: code, fullname, email, username, password…
            </p>
            <div className="student-import-template-actions">
              <Select value={templateFormat} onChange={setTemplateFormat} aria-label="Định dạng mẫu import">
                {IMPORT_FORMATS.map(format => <Option value={format} key={format}>{format.toUpperCase()}</Option>)}
              </Select>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                Tải file mẫu
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Import dữ liệu" className="student-import-card">
            <Upload
              accept=".csv,.xlsx,.json,.xml"
              beforeUpload={chooseFile}
              showUploadList={false}
              disabled={importing}
            >
              <Button icon={<UploadOutlined />} disabled={importing}>Chọn file</Button>
            </Upload>
            <div className="student-import-help">Chấp nhận CSV, XLSX, JSON, XML; dung lượng tối đa 10MB.</div>

            {selectedFile ? (
              <div className="student-import-file" aria-live="polite">
                <FileTextOutlined className="student-import-file-icon" />
                <div className="student-import-file-meta">
                  <strong title={selectedFile.name}>{selectedFile.name}</strong>
                  <span>{formatFileSize(selectedFile.size)} · {getFileExtension(selectedFile.name).toUpperCase()}</span>
                </div>
                <Upload
                  accept=".csv,.xlsx,.json,.xml"
                  beforeUpload={chooseFile}
                  showUploadList={false}
                  disabled={importing}
                >
                  <Button type="link" disabled={importing}>Chọn file khác</Button>
                </Upload>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={removeFile} disabled={importing} aria-label="Xóa file đã chọn" />
              </div>
            ) : (
              <Empty className="student-import-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa chọn file import" />
            )}

            {(fileError || importError) && <Alert className="mt-3" type="error" showIcon message={fileError || importError} />}

            <div className="student-import-actions">
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={importing}
                disabled={!selectedFile || importing}
                onClick={handleImport}
              >
                Import dữ liệu
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {result && (
        <div className="student-import-results">
          <Card title="Kết quả import" className="student-import-card">
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tạo thành công">
                <Tag color="green">{createdRecords.length} bản ghi</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thất bại">
                <Tag color={failedRecords.length ? 'red' : 'default'}>{failedRecords.length} bản ghi</Tag>
              </Descriptions.Item>
            </Descriptions>
            {failedRecords.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`Import hoàn tất một phần: ${createdRecords.length} bản ghi thành công, ${failedRecords.length} bản ghi cần xử lý lại.`}
              />
            )}
          </Card>

          <Card title={`Bản ghi tạo thành công (${createdRecords.length})`} className="student-import-card">
            <Table
              columns={previewColumns}
              dataSource={createdRecords}
              rowKey={(record, index) => record.id || record.code || index}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              scroll={{ x: 900 }}
              locale={{ emptyText: 'Không có bản ghi nào được tạo.' }}
            />
          </Card>

          {failedRecords.length > 0 && (
            <Card title={`Bản ghi lỗi (${failedRecords.length})`} className="student-import-card">
              <Table
                columns={errorColumns}
                dataSource={failedRecords}
                rowKey={(record, index) => `${record.row || 'row'}-${index}`}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: 650 }}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default StudentImport
