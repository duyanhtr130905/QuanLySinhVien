import React, { useEffect, useState } from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Empty, Result, Skeleton, Table, Tooltip,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import ClassService from 'services/ClassService'
import {
  readClassCopyResult, rememberCopiedClassId, saveClassCopyResult,
} from '../classUtils'
import '../Class.css'

const ClassCopyResult = () => {
  const history = useHistory()
  const location = useLocation()
  const routeResult = location.state?.copyResult
  const listState = location.state?.classListState
  const [rows, setRows] = useState(() => (
    Array.isArray(routeResult?.created) ? routeResult.created : []
  ))
  const [notFound, setNotFound] = useState(() => (
    Array.isArray(routeResult?.notFound) ? routeResult.notFound : []
  ))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [hasReference, setHasReference] = useState(Boolean(routeResult))
  const listRoute = {
    pathname: '/app/class/list',
    state: listState ? { classListState: listState } : undefined,
  }

  useEffect(() => {
    let active = true
    if (routeResult) {
      saveClassCopyResult(routeResult)
      const created = Array.isArray(routeResult.created) ? routeResult.created : []
      created.forEach(item => rememberCopiedClassId(item.id))
      return () => { active = false }
    }

    const stored = readClassCopyResult()
    if (!stored) {
      setHasReference(false)
      return () => { active = false }
    }

    setHasReference(true)
    setNotFound(stored.notFound)
    if (!stored.createdIds.length) return () => { active = false }

    setLoading(true)
    ClassService.getAll({ columnlist: 'id,code,name,description' })
      .then(response => {
        if (!active) return
        const records = Array.isArray(response?.data) ? response.data : []
        const ids = new Set(stored.createdIds)
        const restored = records.filter(item => ids.has(Number(item.id)))
        setRows(restored)
        if (!restored.length) setLoadError('Không thể tải lại các bản sao đã tạo.')
      })
      .catch(() => {
        if (active) setLoadError('Không thể tải lại các bản sao đã tạo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [routeResult])

  const columns = [
    { title: 'Mã lớp', dataIndex: 'code', key: 'code', render: value => value || '-' },
    { title: 'Tên lớp', dataIndex: 'name', key: 'name', render: value => value || '-' },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: value => value || '-',
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Tooltip title="Chỉnh sửa bản sao">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              rememberCopiedClassId(record.id)
              history.push(`/app/class/copy/${record.id}`, {
                classListState: listState,
                copyResultReturn: true,
                copiedClass: record,
              })
            }}
          />
        </Tooltip>
      ),
    },
  ]

  const renderContent = () => {
    if (!hasReference) {
      return (
        <Result
          status="info"
          title="Không còn dữ liệu kết quả sao chép."
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
        />
      )
    }
    if (loading) return <Skeleton active paragraph={{ rows: 5 }} />
    if (loadError) {
      return (
        <Result
          status="error"
          title={loadError}
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
        />
      )
    }
    if (!rows.length) {
      return (
        <Result
          status="warning"
          title="Không có lớp nào được sao chép thành công."
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
        />
      )
    }
    return (
      <>
        <Alert
          className="mb-3"
          type={notFound.length ? 'warning' : 'success'}
          showIcon
          message={notFound.length
            ? `Sao chép thành công ${rows.length} lớp, không tìm thấy ${notFound.length} lớp.`
            : `Sao chép thành công ${rows.length} lớp.`}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="Không có dữ liệu bản sao" /> }}
        />
      </>
    )
  }

  return (
    <div className="class-copy-result-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Danh mục Lớp</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Sao chép nhiều</Breadcrumb.Item>
      </Breadcrumb>
      <h1>Sao chép nhiều bản ghi Lớp</h1>
      <Card>{renderContent()}</Card>
      <Button
        className="class-copy-result-back"
        icon={<ArrowLeftOutlined />}
        onClick={() => history.push(listRoute)}
      >
        Trở về Danh sách Lớp
      </Button>
    </div>
  )
}

export default ClassCopyResult
