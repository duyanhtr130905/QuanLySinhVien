import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Descriptions, Empty, Table, Tag, Upload,
} from 'antd'
import { DeleteOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import { clearClassImport, importClasses } from 'redux/actions/Class'
import {
  formatFileSize, getFileExtension, validateImportFile,
} from '../../student/student-import/studentImportUtils'
import '../../student/student-import/StudentImport.css'

const getErrorMessage = error => error?.message || error?.data?.message || (
  'Không thể import dữ liệu Lớp. Vui lòng kiểm tra file và thử lại.'
)

const ClassImport = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const importing = useSelector(state => state.classroom.importLoading)
  const importError = useSelector(state => state.classroom.importError)
  const storedResult = useSelector(state => state.classroom.importResult)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [result, setResult] = useState(null)
  const listRoute = {
    pathname: '/app/class/list',
    state: location.state?.classListState ? { classListState: location.state.classListState } : undefined,
  }

  useEffect(() => {
    dispatch(clearClassImport())
    return () => dispatch(clearClassImport())
  }, [dispatch])

  useEffect(() => {
    if (storedResult) setResult(storedResult)
  }, [storedResult])

  const chooseFile = file => {
    const validationError = validateImportFile(file)
    if (validationError) {
      setFileError(validationError)
      return false
    }
    setSelectedFile(file)
    setFileError('')
    setResult(null)
    dispatch(clearClassImport())
    return false
  }

  const removeFile = () => {
    if (importing) return
    setSelectedFile(null)
    setFileError('')
    setResult(null)
    dispatch(clearClassImport())
  }

  const handleImport = () => {
    if (importing) return
    const validationError = validateImportFile(selectedFile)
    if (validationError) {
      setFileError(validationError)
      return
    }
    const formData = new FormData()
    formData.append('file', selectedFile)
    dispatch(importClasses(
      formData,
      data => {
        const created = Array.isArray(data?.created) ? data.created : []
        const failed = Array.isArray(data?.failed) ? data.failed : []
        setResult({ ...data, created, failed })
      },
      error => setFileError(getErrorMessage(error))
    ))
  }

  const createdRecords = Array.isArray(result?.created) ? result.created : []
  const failedRecords = Array.isArray(result?.failed) ? result.failed : []
  const createdColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', render: value => value || '-' },
    { title: 'Mã lớp', dataIndex: 'code', key: 'code', render: value => value || '-' },
    { title: 'Tên lớp', dataIndex: 'name', key: 'name', render: value => value || '-' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: value => value || '-' },
  ]
  const errorColumns = [
    { title: 'Số dòng', dataIndex: 'row', key: 'row', width: 100, render: value => value || '-' },
    { title: 'Mã lớp', dataIndex: 'code', key: 'code', render: value => value || '-' },
    { title: 'Lý do lỗi', dataIndex: 'reason', key: 'reason', render: value => value || 'Lỗi không xác định' },
  ]

  return (
    <div className="student-import-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Lớp</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Import dữ liệu</Breadcrumb.Item>
      </Breadcrumb>
      <div className="student-import-header">
        <div>
          <h1>Import dữ liệu Lớp</h1>
          <p>File dùng các trường code, name và description (không bắt buộc).</p>
        </div>
        <Button onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>
      </div>
      <Card title="Chọn file import" className="student-import-card">
        <Upload accept=".csv,.xlsx,.json,.xml" beforeUpload={chooseFile} showUploadList={false} disabled={importing}>
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
            <Button type="text" danger icon={<DeleteOutlined />} onClick={removeFile} disabled={importing} aria-label="Xóa file đã chọn" />
          </div>
        ) : <Empty className="student-import-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa chọn file import" />}
        {(fileError || importError) && <Alert className="mt-3" type="error" showIcon message={fileError || importError} />}
        <div className="student-import-actions">
          <Button type="primary" icon={<UploadOutlined />} loading={importing} disabled={!selectedFile || importing} onClick={handleImport}>Nhập dữ liệu</Button>
          <Button disabled={importing} onClick={() => history.push(listRoute)}>Hủy</Button>
        </div>
      </Card>
      {result && (
        <div className="student-import-results">
          <Card title="Kết quả import" className="student-import-card">
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tạo thành công"><Tag color="green">{createdRecords.length} bản ghi</Tag></Descriptions.Item>
              <Descriptions.Item label="Thất bại"><Tag color={failedRecords.length ? 'red' : 'default'}>{failedRecords.length} bản ghi</Tag></Descriptions.Item>
            </Descriptions>
            {failedRecords.length > 0 && <Alert type="warning" showIcon message="Import hoàn tất một phần; xem các dòng lỗi bên dưới." />}
          </Card>
          <Card title={`Bản ghi tạo thành công (${createdRecords.length})`} className="student-import-card">
            <Table columns={createdColumns} dataSource={createdRecords} rowKey={(record, index) => record.id || record.code || index} pagination={{ pageSize: 10, hideOnSinglePage: true }} />
          </Card>
          {failedRecords.length > 0 && <Card title={`Bản ghi lỗi (${failedRecords.length})`} className="student-import-card">
            <Table columns={errorColumns} dataSource={failedRecords} rowKey={(record, index) => `${record.row || 'row'}-${index}`} pagination={{ pageSize: 10, hideOnSinglePage: true }} />
          </Card>}
        </div>
      )}
    </div>
  )
}

export default ClassImport
