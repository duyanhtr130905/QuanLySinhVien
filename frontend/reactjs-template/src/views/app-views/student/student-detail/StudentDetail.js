import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useHistory, useLocation, useParams } from 'react-router-dom'
import {
  Avatar, Breadcrumb, Button, Card, Col, Descriptions, Dropdown, Image,
  Menu, message, Modal, Result, Row, Skeleton, Tag
} from 'antd'
import {
  ArrowLeftOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined,
  EditOutlined, UserOutlined
} from '@ant-design/icons'
import ClassService from 'services/ClassService'
import HobbyService from 'services/HobbyService'
import StudentService from 'services/StudentService'
import downloadBlob, {
  getBlobErrorMessage, getDownloadFilename
} from 'utils/downloadBlob'
import {
  clearStudentDetail, deleteStudent, fetchStudentDetail
} from 'redux/actions/Student'
import {
  decodeHobbyBitmask
} from '../student-create/studentFormUtils'
import {
  formatStudentDate as formatDate, formatStudentDateTime as formatDateTime,
  getSafeHttpUrl, unwrapCollection
} from '../studentUtils'
import {
  getCopyErrorMessage, rememberCopiedStudentId, unwrapCopiedStudent
} from '../student-copy/copyUtils'
import './StudentDetail.css'

const safeText = value => (
  value === null || value === undefined || String(value).trim() === ''
    ? '-'
    : String(value)
)

const isValidEmail = value => (
  typeof value === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
)

const getClassLabel = item => {
  if (!item) return null
  if (typeof item === 'string') return item
  const name = item.name || item.class_name || item.className
  if (item.code && name) return `${item.code} - ${name}`
  return name || item.code || null
}

const sanitizeFilePart = value => (
  String(value || 'unknown').trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'unknown'
)

const StudentDetail = () => {
  const { id: routeId } = useParams()
  const history = useHistory()
  const location = useLocation()
  const dispatch = useDispatch()
  const detail = useSelector(state => state.student.detail)
  const detailLoading = useSelector(state => state.student.detailLoading)
  const detailError = useSelector(state => state.student.detailError)
  const deleting = useSelector(state => state.student.deleteLoading)

  const numericId = Number(routeId)
  const validId = /^\d+$/.test(String(routeId)) && Number.isSafeInteger(numericId) && numericId > 0
  const detailMatchesRoute = Number(detail?.id) === numericId

  const [classes, setClasses] = useState([])
  const [hobbyOptions, setHobbyOptions] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [hobbiesLoading, setHobbiesLoading] = useState(false)
  const [classesError, setClassesError] = useState(false)
  const [hobbiesError, setHobbiesError] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [deleteVisible, setDeleteVisible] = useState(false)
  const [copyVisible, setCopyVisible] = useState(false)
  const [copying, setCopying] = useState(false)
  const [exportingType, setExportingType] = useState(null)

  const listRoute = {
    pathname: '/app/student/list',
    state: location.state?.studentListState
      ? { studentListState: location.state.studentListState }
      : undefined,
  }
  const goBackToList = () => history.push(listRoute)

  useEffect(() => {
    dispatch(clearStudentDetail())
    if (validId) dispatch(fetchStudentDetail(numericId))

    return () => dispatch(clearStudentDetail())
  }, [dispatch, numericId, validId])

  useEffect(() => {
    if (!validId) return undefined

    setClassesLoading(true)
    setClassesError(false)
    ClassService.getAll()
      .then(response => setClasses(unwrapCollection(response)))
      .catch(() => {
        setClasses([])
        setClassesError(true)
      })
      .finally(() => setClassesLoading(false))

    setHobbiesLoading(true)
    setHobbiesError(false)
    HobbyService.getAll()
      .then(response => setHobbyOptions(unwrapCollection(response)))
      .catch(() => {
        setHobbyOptions([])
        setHobbiesError(true)
      })
      .finally(() => setHobbiesLoading(false))

    return undefined
  }, [validId])

  useEffect(() => {
    setImageFailed(false)
  }, [detail?.attachment])

  const selectedHobbies = useMemo(
    () => decodeHobbyBitmask(detail?.hobbies, hobbyOptions),
    [detail?.hobbies, hobbyOptions]
  )

  const renderClass = () => {
    const joinedClass = detail?.class || detail?.class_info
    const joinedLabel = getClassLabel(joinedClass) || detail?.class_name
    if (joinedLabel) return joinedLabel
    if (detail?.class_id === null || detail?.class_id === undefined) {
      return <Tag>Chưa xếp lớp</Tag>
    }
    if (classesLoading) return <Skeleton.Input active size="small" />
    if (classesError) return 'Không xác định'
    const matchedClass = classes.find(item => Number(item.id) === Number(detail.class_id))
    return getClassLabel(matchedClass) || 'Không xác định'
  }

  const renderSex = () => {
    if (detail?.sex === true) return 'Nam'
    if (detail?.sex === false) return 'Nữ'
    return '-'
  }

  const renderEmail = () => {
    if (!isValidEmail(detail?.email)) return safeText(detail?.email)
    const email = detail.email.trim()
    return <a className="student-detail-link" href={`mailto:${email}`}>{email}</a>
  }

  const renderFacebook = () => {
    const url = getSafeHttpUrl(detail?.facebook)
    if (!url) return safeText(detail?.facebook)
    return (
      <a
        className="student-detail-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {detail.facebook}
      </a>
    )
  }

  const renderHairColor = () => {
    const value = typeof detail?.hair_color === 'string' ? detail.hair_color.trim() : ''
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return safeText(value)
    return (
      <span className="student-detail-color">
        <span className="student-detail-color-swatch" style={{ backgroundColor: value }} />
        {value.toUpperCase()}
      </span>
    )
  }

  const renderHobbies = () => {
    const mask = Number(detail?.hobbies)
    if (!Number.isSafeInteger(mask) || mask <= 0) return 'Chưa có sở thích'
    if (hobbiesLoading) return <Skeleton.Input active size="small" />
    if (hobbiesError) return 'Không thể tải sở thích'
    if (!selectedHobbies.length) return 'Chưa có sở thích'
    return (
      <div className="student-detail-hobbies">
        {selectedHobbies.map(item => (
          <Tag color="blue" key={item.id || item.bit_value}>
            {item.name || item.code}
          </Tag>
        ))}
      </div>
    )
  }

  const handleDelete = () => {
    if (deleting) return
    dispatch(deleteStudent(numericId, () => {
      setDeleteVisible(false)
      message.success('Xóa sinh viên thành công')
      goBackToList()
    }))
  }

  const handleCopy = async () => {
    if (copying) return
    setCopying(true)
    try {
      const response = await StudentService.copyOne(numericId)
      const created = unwrapCopiedStudent(response)
      const createdId = Number(created?.id)
      if (!Number.isSafeInteger(createdId) || createdId <= 0) {
        throw new Error('Không nhận được ID của bản sao')
      }
      rememberCopiedStudentId(createdId)
      setCopyVisible(false)
      message.success('Sao chép sinh viên thành công')
      history.push(`/app/student/copy/${createdId}`, {
        ...(location.state || {}),
        copiedStudent: created,
      })
    } catch (error) {
      message.error(getCopyErrorMessage(error))
    } finally {
      setCopying(false)
    }
  }

  const handleExport = async type => {
    if (exportingType) return
    setExportingType(type)
    try {
      const response = await StudentService.exportOne(numericId, type)
      const blob = response?.data
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('File export rỗng')
      }
      const extension = type === 'xlsx' ? 'xlsx' : type
      const fallback = `student-${sanitizeFilePart(detail?.code)}.${extension}`
      const filename = getDownloadFilename(response.headers?.['content-disposition'], fallback)
      downloadBlob(blob, filename)
    } catch (error) {
      message.error(await getBlobErrorMessage(
        error,
        'Không thể export sinh viên. Vui lòng thử lại.'
      ))
    } finally {
      setExportingType(null)
    }
  }

  const exportMenu = (
    <Menu onClick={({ key }) => handleExport(key)}>
      <Menu.Item key="csv">CSV</Menu.Item>
      <Menu.Item key="xlsx">Excel</Menu.Item>
      <Menu.Item key="json">JSON</Menu.Item>
      <Menu.Item key="xml">XML</Menu.Item>
    </Menu>
  )

  const renderContent = () => {
    if (!validId) {
      return (
        <Card>
          <Result
            status="warning"
            title="ID sinh viên không hợp lệ."
            extra={<Button type="primary" onClick={goBackToList}>Trở về danh sách Sinh viên</Button>}
          />
        </Card>
      )
    }

    if (detailLoading) {
      return (
        <Card className="student-detail-card" aria-busy="true">
          <Skeleton active avatar paragraph={{ rows: 10 }} />
        </Card>
      )
    }

    if (detailError) {
      const notFound = Number(detailError.status) === 404
      return (
        <Card>
          <Result
            status={notFound ? '404' : 'error'}
            title={notFound ? 'Không tìm thấy sinh viên.' : 'Không thể tải thông tin sinh viên.'}
            subTitle={notFound ? undefined : safeText(detailError.message)}
            extra={[
              !notFound && (
                <Button
                  key="retry"
                  type="primary"
                  onClick={() => dispatch(fetchStudentDetail(numericId))}
                >
                  Thử lại
                </Button>
              ),
              <Button key="back" onClick={goBackToList}>Trở về danh sách Sinh viên</Button>
            ].filter(Boolean)}
          />
        </Card>
      )
    }

    if (!detailMatchesRoute) {
      return (
        <Card className="student-detail-card" aria-busy="true">
          <Skeleton active avatar paragraph={{ rows: 10 }} />
        </Card>
      )
    }

    const imageUrl = getSafeHttpUrl(detail.attachment)

    return (
      <>
        <Row gutter={[20, 0]}>
          <Col xs={24} lg={17}>
            <Card title="Thông tin cá nhân" className="student-detail-card">
              <Descriptions column={{ xs: 1, sm: 2 }} layout="vertical">
                <Descriptions.Item label="Mã học sinh">
                  <Tag color="blue">{safeText(detail.code)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Họ và tên">
                  <span className="student-detail-name">{safeText(detail.fullname)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">{formatDate(detail.dob)}</Descriptions.Item>
                <Descriptions.Item label="Giới tính">{renderSex()}</Descriptions.Item>
                <Descriptions.Item label="Lớp">{renderClass()}</Descriptions.Item>
                <Descriptions.Item label="Quê quán">
                  <span className="student-detail-value">{safeText(detail.homecity)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ" span={2}>
                  <span className="student-detail-value">{safeText(detail.address)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Email">{renderEmail()}</Descriptions.Item>
                <Descriptions.Item label="Facebook">{renderFacebook()}</Descriptions.Item>
                <Descriptions.Item label="Màu tóc">{renderHairColor()}</Descriptions.Item>
                <Descriptions.Item label="Sở thích">{renderHobbies()}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Mô tả" className="student-detail-card">
              <p className="student-detail-description">
                {detail.description ? String(detail.description) : 'Chưa có mô tả'}
              </p>
            </Card>
          </Col>

          <Col xs={24} lg={7}>
            <Card title="Ảnh thẻ" className="student-detail-card">
              <div className="student-detail-photo">
                {imageUrl && !imageFailed ? (
                  <Image
                    src={imageUrl}
                    alt={`Ảnh thẻ của ${safeText(detail.fullname)}`}
                    preview
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div
                    className="student-detail-photo-fallback"
                    role="img"
                    aria-label={`Không có ảnh thẻ của ${safeText(detail.fullname)}`}
                  >
                    <Avatar shape="square" size={96} icon={<UserOutlined />} />
                  </div>
                )}
              </div>
            </Card>

            <Card title="Thông tin tài khoản" className="student-detail-card">
              <Descriptions column={1} layout="vertical">
                <Descriptions.Item label="Tài khoản">
                  {safeText(detail.username)}
                </Descriptions.Item>
                <Descriptions.Item label="Email">{renderEmail()}</Descriptions.Item>
                <Descriptions.Item label="Thời gian tạo">
                  {formatDateTime(detail.created_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian cập nhật">
                  {formatDateTime(detail.updated_at)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <div className="student-detail-footer">
          <Button icon={<ArrowLeftOutlined />} onClick={goBackToList}>
            Trở về danh mục
          </Button>
        </div>
      </>
    )
  }

  const canUseActions = validId && detailMatchesRoute && !detailLoading && !detailError

  return (
    <div className="student-detail-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Sinh viên</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Xem chi tiết</Breadcrumb.Item>
      </Breadcrumb>

      <div className="student-detail-header">
        <h1 className="student-detail-heading">Chi tiết Sinh viên</h1>
        {canUseActions && (
          <div className="student-detail-actions">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteVisible(true)}
            >
              Xóa
            </Button>
            <Dropdown overlay={exportMenu} trigger={['click']} disabled={Boolean(exportingType)}>
              <Button
                icon={<DownloadOutlined />}
                loading={Boolean(exportingType)}
                aria-label="Chọn định dạng export sinh viên"
              >
                Export
              </Button>
            </Dropdown>
            <Button icon={<CopyOutlined />} onClick={() => setCopyVisible(true)}>
              Sao chép
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => history.push(`/app/student/edit/${numericId}`, location.state)}
            >
              Chỉnh sửa
            </Button>
          </div>
        )}
      </div>

      {renderContent()}

      <Modal
        visible={deleteVisible}
        title="Xác nhận xóa sinh viên"
        okText="Xóa"
        okType="danger"
        cancelText="Hủy"
        confirmLoading={deleting}
        closable={!deleting}
        maskClosable={!deleting}
        onOk={handleDelete}
        onCancel={() => !deleting && setDeleteVisible(false)}
      >
        Bạn có chắc chắn muốn xóa sinh viên ‘{safeText(detail?.fullname)}’ không?
        {' '}Hành động này không thể hoàn tác trên giao diện.
      </Modal>

      <Modal
        visible={copyVisible}
        title="Sao chép sinh viên"
        okText="Sao chép"
        cancelText="Hủy"
        confirmLoading={copying}
        closable={!copying}
        maskClosable={!copying}
        onOk={handleCopy}
        onCancel={() => !copying && setCopyVisible(false)}
      >
        Tạo một bản sao từ sinh viên ‘{safeText(detail?.fullname)}’?
      </Modal>
    </div>
  )
}

export default StudentDetail
