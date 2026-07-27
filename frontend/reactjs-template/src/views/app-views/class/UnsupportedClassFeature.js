import React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { Alert, Breadcrumb, Button, Card } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import './Class.css'

const UnsupportedClassFeature = ({ feature }) => {
  const history = useHistory()
  const location = useLocation()
  const listState = location.state?.classListState
  const listRoute = {
    pathname: '/app/class/list',
    state: listState ? { classListState: listState } : undefined,
  }
  const isImport = feature === 'import'
  const label = isImport ? 'Import' : 'Export'

  return (
    <div className="class-unsupported-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Danh mục Lớp</Link></Breadcrumb.Item>
        <Breadcrumb.Item>{label}</Breadcrumb.Item>
      </Breadcrumb>
      <h1>{label} Lớp</h1>
      <Card>
        <Alert
          type="info"
          showIcon
          message={`Backend hiện chưa hỗ trợ ${label.toLowerCase()} Lớp.`}
          description={
            `Frontend không gửi yêu cầu tới endpoint /class/${feature} vì route này không tồn tại trong backend hiện tại.`
          }
        />
        <Button
          className="class-unsupported-back"
          icon={<ArrowLeftOutlined />}
          onClick={() => history.push(listRoute)}
        >
          Trở về Danh sách Lớp
        </Button>
      </Card>
    </div>
  )
}

export default UnsupportedClassFeature
