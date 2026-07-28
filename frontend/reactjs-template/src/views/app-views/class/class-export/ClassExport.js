import React, { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Empty, message, Select, Table,
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons'
import { exportManyClasses } from 'redux/actions/Class'
import '../../student/student-export/StudentExport.css'

const EXPORT_TYPES = ['csv', 'xlsx', 'json', 'xml']

const ClassExport = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const listState = location.state?.classListState
  const selectedRowKeys = useMemo(() => (
    Array.isArray(listState?.selectedRowKeys) ? listState.selectedRowKeys : []
  ), [listState])
  const selectedRecordsById = listState?.selectedRecordsById || {}
  const rows = useMemo(() => selectedRowKeys.map(id => selectedRecordsById[id] || { id }).filter(Boolean), [selectedRecordsById, selectedRowKeys])
  const exporting = useSelector(state => state.classroom.exportManyLoading)
  const exportError = useSelector(state => state.classroom.exportError)
  const [type, setType] = useState('xlsx')
  const listRoute = {
    pathname: '/app/class/list',
    state: listState ? { classListState: listState } : undefined,
  }
  const columns = [
    { title: 'Mã lớp', dataIndex: 'code', key: 'code', render: value => value || '-' },
    { title: 'Tên lớp', dataIndex: 'name', key: 'name', render: value => value || '-' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: value => value || '-' },
  ]

  const handleExport = exportType => {
    if (!selectedRowKeys.length || exporting || !EXPORT_TYPES.includes(exportType)) return
    dispatch(exportManyClasses(
      selectedRowKeys,
      exportType,
      `classes-export.${exportType}`,
      () => message.success('Đã bắt đầu tải file xuất dữ liệu.'),
      () => {}
    ))
  }

  return (
    <div className="student-export-page">
      <div className="student-export-actions no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>
      </div>
      <Breadcrumb className="student-export-breadcrumb no-print">
        <Breadcrumb.Item>Quản lý danh mục</Breadcrumb.Item>
        <Breadcrumb.Item>Lớp</Breadcrumb.Item>
        <Breadcrumb.Item>Xuất dữ liệu</Breadcrumb.Item>
      </Breadcrumb>
      <Card className="student-export-config no-print">
        <div className="student-export-config-row">
          <div>
            <label htmlFor="class-export-format">Định dạng export</label>
            <Select id="class-export-format" value={type} onChange={setType} style={{ minWidth: 180 }}>
              {EXPORT_TYPES.map(format => <Select.Option key={format} value={format}>{format.toUpperCase()}</Select.Option>)}
            </Select>
          </div>
          <Button type="primary" icon={<DownloadOutlined />} loading={exporting} disabled={!selectedRowKeys.length} onClick={() => handleExport(type)}>Xuất {selectedRowKeys.length} lớp</Button>
        </div>
        <p className="mt-3 mb-0">Backend chỉ export ba trường cố định: code, name và description; preview phản ánh đúng giới hạn này.</p>
      </Card>
      <Card className="student-export-preview" title="Preview dữ liệu đã chọn">
        {!selectedRowKeys.length && <Alert type="warning" showIcon message="Vui lòng chọn ít nhất một Lớp từ danh sách trước khi export." />}
        {exportError && <Alert className="mb-3" type="error" showIcon message={exportError} />}
        {selectedRowKeys.length > 0 && !rows.length && <Empty description="Không có dữ liệu để preview" />}
        {selectedRowKeys.length > 0 && rows.length > 0 && <Table rowKey="id" columns={columns} dataSource={rows} pagination={false} />}
      </Card>
    </div>
  )
}

export default ClassExport
