import React, { useEffect, useMemo, useState } from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Empty, Result, Skeleton, Table, Tooltip
} from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import ClassService from 'services/ClassService'
import StudentService from 'services/StudentService'
import {
  formatStudentDate as formatDate, formatStudentSex as formatSex,
  unwrapCollection
} from '../studentUtils'
import {
  readCopyResultSession, saveCopyResultSession, unwrapCopiedStudent
} from './copyUtils'
import './StudentCopyResult.css'

const getClassName = (record, classMap) => {
  const joined = record?.class || record?.class_info
  const joinedName = joined?.name || joined?.class_name || joined?.className || joined?.code
  if (joinedName) return joinedName
  if (record?.class_id === null || record?.class_id === undefined) return 'Chưa xếp lớp'
  return classMap[record.class_id] || 'Không xác định'
}

const StudentCopyResult = () => {
  const history = useHistory()
  const location = useLocation()
  const routeResult = location.state?.copyResult
  const listState = location.state?.studentListState
  const [rows, setRows] = useState(() => (
    Array.isArray(routeResult?.created) ? routeResult.created : []
  ))
  const [notFound, setNotFound] = useState(() => (
    Array.isArray(routeResult?.notFound) ? routeResult.notFound : []
  ))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [hasResultReference, setHasResultReference] = useState(Boolean(routeResult))
  const [classMap, setClassMap] = useState({})

  const listRoute = {
    pathname: '/app/student/list',
    state: listState ? { studentListState: listState } : undefined,
  }

  useEffect(() => {
    ClassService.getAll()
      .then(response => {
        const classes = unwrapCollection(response)
        setClassMap(classes.reduce((map, item) => ({
          ...map,
          [item.id]: item.name || item.class_name || item.className || item.code || item.id,
        }), {}))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    if (routeResult) {
      saveCopyResultSession(routeResult)
      return () => { active = false }
    }

    const stored = readCopyResultSession()
    if (!stored) {
      setHasResultReference(false)
      return () => { active = false }
    }

    setHasResultReference(true)
    setNotFound(stored.notFound)
    if (!stored.createdIds.length) return () => { active = false }

    setLoading(true)
    Promise.allSettled(stored.createdIds.map(id => StudentService.getById(id)))
      .then(results => {
        if (!active) return
        const restored = results
          .filter(result => result.status === 'fulfilled')
          .map(result => unwrapCopiedStudent(result.value))
          .filter(Boolean)
        setRows(restored)
        if (!restored.length) setLoadError('Không thể tải lại các bản sao đã tạo.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [routeResult])

  const columns = useMemo(() => [
    { title: 'Mã học sinh', dataIndex: 'code', key: 'code', render: value => value || '-' },
    { title: 'Họ và tên', dataIndex: 'fullname', key: 'fullname', render: value => value || '-' },
    { title: 'Ngày sinh', dataIndex: 'dob', key: 'dob', render: formatDate },
    { title: 'Giới tính', dataIndex: 'sex', key: 'sex', render: formatSex },
    { title: 'Lớp', key: 'class', render: (_, record) => getClassName(record, classMap) },
    { title: 'Email', dataIndex: 'email', key: 'email', render: value => value || '-' },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Tooltip title="Chỉnh sửa bản sao">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => history.push(`/app/student/copy/${record.id}`, {
              studentListState: listState,
              copyResultReturn: true,
              copiedStudent: record,
            })}
          />
        </Tooltip>
      )
    },
  ], [classMap, history, listState])

  const renderContent = () => {
    if (!hasResultReference) {
      return (
        <Result
          status="info"
          title="Không còn dữ liệu kết quả sao chép."
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Sinh viên</Button>}
        />
      )
    }
    if (loading) return <Skeleton active paragraph={{ rows: 8 }} />
    if (loadError) {
      return (
        <Result
          status="error"
          title={loadError}
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Sinh viên</Button>}
        />
      )
    }
    if (!rows.length) {
      return (
        <Result
          status="error"
          title="Không có bản ghi nào được sao chép thành công."
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Sinh viên</Button>}
        />
      )
    }
    return (
      <>
        <Alert
          className="student-copy-result-alert"
          type={notFound.length ? 'warning' : 'success'}
          showIcon
          message={notFound.length
            ? `Sao chép thành công ${rows.length} bản ghi, không tìm thấy ${notFound.length} bản ghi.`
            : `Sao chép thành công ${rows.length} bản ghi`}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="Không có dữ liệu bản sao" /> }}
          scroll={{ x: 'max-content' }}
        />
      </>
    )
  }

  return (
    <div className="student-copy-result-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Danh mục Sinh viên</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Sao chép nhiều</Breadcrumb.Item>
      </Breadcrumb>
      <h1>Sao chép nhiều bản ghi Sinh viên</h1>
      <p className="text-muted">
        Các bản ghi đã chọn được sao chép thành công, bạn có thể hiệu chỉnh từng bản ghi sau
      </p>
      <Card>{renderContent()}</Card>
      <Button
        className="student-copy-result-back"
        icon={<ArrowLeftOutlined />}
        onClick={() => history.push(listRoute)}
      >
        Trở về Danh sách Sinh viên
      </Button>
    </div>
  )
}

export default StudentCopyResult
