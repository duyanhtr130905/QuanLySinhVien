import React, { useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link, useHistory, useLocation } from 'react-router-dom'
import {
  Alert, Breadcrumb, Button, Card, Empty, Result, Table, Tooltip, message,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { rememberCopiedClassId, saveClassCopyResult } from '../classUtils'
import '../Class.css'

const ClassCopyResult = () => {
  const history = useHistory()
  const location = useLocation()
  const reduxResult = useSelector(state => state.classroom.copyResult)
  const result = location.state?.copyResult || reduxResult
  const listState = location.state?.classListState
  const rows = useMemo(() => (
    Array.isArray(result) ? result : (Array.isArray(result?.created) ? result.created : [])
  ), [result])
  const notFound = useMemo(() => (
    Array.isArray(result?.notFound) ? result.notFound : []
  ), [result])
  const listRoute = {
    pathname: '/app/class/list',
    state: listState ? { classListState: listState } : undefined,
  }

  useEffect(() => {
    if (!result) {
      message.info('Không còn dữ liệu kết quả sao chép. Vui lòng thực hiện lại từ Danh sách Lớp.')
      return
    }
    saveClassCopyResult({ created: rows, notFound })
    rows.forEach(item => rememberCopiedClassId(item.id))
  }, [notFound, result, rows])

  const columns = [
    { title: 'Mã lớp', dataIndex: 'code', key: 'code', render: value => value || '-' },
    { title: 'Tên lớp', dataIndex: 'name', key: 'name', render: value => value || '-' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: value => value || '-' },
    {
      title: 'Hành động', key: 'action', align: 'right',
      render: (_, record) => (
        <Tooltip title="Chỉnh sửa bản sao">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => history.push(`/app/class/edit/${record.id}`, {
              classListState: listState,
              copyResultReturn: true,
            })}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="class-copy-result-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Lớp</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Sao chép nhiều</Breadcrumb.Item>
      </Breadcrumb>
      <h1>Sao chép nhiều bản ghi Lớp</h1>
      <Card>
        {!result ? (
          <Result
            status="info"
            title="Không còn dữ liệu kết quả sao chép."
            extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
          />
        ) : !rows.length ? (
          <Result
            status="warning"
            title="Không có lớp nào được sao chép thành công."
            extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
          />
        ) : (
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
        )}
      </Card>
      <Button className="class-copy-result-back" icon={<ArrowLeftOutlined />} onClick={() => history.push(listRoute)}>
        Trở về Danh sách Lớp
      </Button>
    </div>
  )
}

export default ClassCopyResult
