import React, { useEffect, useMemo, useState } from 'react'
import { Prompt, useHistory, useLocation } from 'react-router-dom'
import { Alert, Avatar, Breadcrumb, Button, Card, Col, Descriptions, Form, Input, Modal, Radio, Result, Row, Table, Tag, Tooltip, Upload } from 'antd'
import { EditOutlined, SaveOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons'
import ClassService from 'services/ClassService'
import { formatStudentDate, formatStudentSex, getSafeHttpUrl, unwrapCollection } from '../student/studentUtils'

const { Search, TextArea } = Input

const classFields = [['code', 'Mã lớp'], ['name', 'Tên lớp'], ['description', 'Mô tả']]

const normalizeDraft = draft => ({
  ...draft,
  values: { ...(draft?.values || {}) },
})

const CopyPreviewPage = ({ entity, service }) => {
  const history = useHistory()
  const location = useLocation()
  const listPath = entity === 'student' ? '/app/student/list' : '/app/class/list'
  const listStateKey = entity === 'student' ? 'studentListState' : 'classListState'
  const preview = location.state?.preview
  const [drafts, setDrafts] = useState(() => (Array.isArray(preview?.drafts) ? preview.drafts.map(normalizeDraft) : []))
  const [editingDraftKey, setEditingDraftKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const [attachmentFiles, setAttachmentFiles] = useState({})
  const [classLabels, setClassLabels] = useState({})
  const [search, setSearch] = useState('')
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 10 })
  const [form] = Form.useForm()
  const dirty = Object.keys(attachmentFiles).length > 0 || drafts.some(draft => (
    JSON.stringify(draft.values) !== JSON.stringify(preview?.drafts?.find(item => item.draftKey === draft.draftKey)?.values)
  ))
  const listRoute = {
    pathname: listPath,
    state: location.state?.[listStateKey] ? { [listStateKey]: location.state[listStateKey] } : undefined,
  }

  useEffect(() => {
    const warn = event => {
      if (!dirty) return undefined
      event.preventDefault()
      event.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (entity !== 'student') return undefined
    let active = true
    const request = ClassService.getAll()
    if (!request || typeof request.then !== 'function') return () => { active = false }
    request
      .then(response => {
        if (!active) return
        setClassLabels(unwrapCollection(response).reduce((labels, item) => ({
          ...labels,
          [item.id]: item.code && item.name ? `${item.code} - ${item.name}` : (item.name || item.code),
        }), {}))
      })
      .catch(() => {})
    return () => { active = false }
  }, [entity])

  const openEditor = draft => {
    setEditingDraftKey(draft.draftKey)
    form.setFieldsValue(draft.values)
  }

  const editingDraft = drafts.find(draft => draft.draftKey === editingDraftKey)

  const saveLocalDraft = () => {
    form.validateFields().then(values => {
      setDrafts(current => current.map(draft => (
        draft.draftKey === editingDraftKey
          ? { ...draft, values: { ...draft.values, ...values } }
          : draft
      )))
      setEditingDraftKey(null)
    })
  }

  const commit = async () => {
    if (!drafts.length || saving) return
    setSaving(true)
    try {
      const payload = entity === 'student' && Object.keys(attachmentFiles).length
        ? (() => {
          const formData = new FormData()
          formData.append('drafts', JSON.stringify(drafts))
          Object.entries(attachmentFiles).forEach(([draftKey, file]) => formData.append(`attachment-${draftKey}`, file))
          return formData
        })()
        : drafts
      await service.commitCopyDrafts(payload)
      history.replace(listRoute)
    } catch (error) {
      Modal.error({
        title: 'Không thể lưu bản sao',
        content: error?.response?.data?.message || error?.message || 'Vui lòng kiểm tra lại dữ liệu và thử lại.',
      })
    } finally {
      setSaving(false)
    }
  }

  const fields = classFields
  const title = entity === 'student' ? 'Xem trước bản sao Sinh viên' : 'Xem trước bản sao Lớp'
  const studentPreviewDrafts = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    if (!keyword) return drafts
    return drafts.filter(draft => ['code', 'fullname', 'email', 'username'].some(key => (
      String(draft.values[key] || '').toLocaleLowerCase('vi').includes(keyword)
    )))
  }, [drafts, search])
  const studentColumns = useMemo(() => [
    {
      title: 'Ảnh', dataIndex: ['values', 'attachment'], key: 'attachment', width: 76,
      render: value => <Avatar shape="square" size={32} src={getSafeHttpUrl(value) || undefined} icon={<UserOutlined />} />,
    },
    { title: 'Mã sinh viên', dataIndex: ['values', 'code'], key: 'code', width: 150, render: value => value || '-' },
    { title: 'Họ và tên', dataIndex: ['values', 'fullname'], key: 'fullname', width: 200, render: value => value || '-' },
    { title: 'Ngày sinh', dataIndex: ['values', 'dob'], key: 'dob', width: 125, render: formatStudentDate },
    { title: 'Giới tính', dataIndex: ['values', 'sex'], key: 'sex', width: 100, render: formatStudentSex },
    { title: 'Email', dataIndex: ['values', 'email'], key: 'email', width: 220, render: value => value || '-' },
    { title: 'Tài khoản', dataIndex: ['values', 'username'], key: 'username', width: 150, render: value => value || '-' },
    {
      title: 'Lớp', dataIndex: ['values', 'class_id'], key: 'class_id', width: 180,
      render: value => value == null || value === '' ? '-' : (classLabels[value] || `Lớp #${value}`),
    },
    {
      title: 'Hành động', key: 'action', fixed: 'right', width: 120, align: 'right',
      render: (_, draft) => (
        <Tooltip title="Chỉnh sửa bản sao">
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={`Chỉnh sửa bản sao sinh viên ${draft.values.code || draft.sourceId}`}
            disabled={saving}
            onClick={() => openEditor(draft)}
          >
            Chỉnh sửa
          </Button>
        </Tooltip>
      ),
    },
  ], [classLabels, saving])

  if (!preview || !drafts.length) {
    return (
      <div>
        <Result
          status="info"
          title="Không còn dữ liệu xem trước"
          subTitle="Draft chỉ tồn tại trong phiên điều hướng. Hãy thực hiện lại thao tác Sao chép từ danh sách."
          extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về danh sách</Button>}
        />
      </div>
    )
  }

  return (
    <div className="copy-preview-page">
      <Prompt when={dirty && !saving} message="Các thay đổi trong draft chưa được lưu. Bạn có chắc muốn rời trang?" />
      <Breadcrumb className="mb-3">
        <Breadcrumb.Item>Quản lý danh mục</Breadcrumb.Item>
        <Breadcrumb.Item>{entity === 'student' ? 'Sinh viên' : 'Lớp'}</Breadcrumb.Item>
        <Breadcrumb.Item>Xem trước sao chép</Breadcrumb.Item>
      </Breadcrumb>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="mb-1">{title}</h1>
          <span>Chỉnh sửa draft cục bộ. Dữ liệu chỉ được tạo khi bấm Lưu tất cả.</span>
        </div>
        <Button onClick={() => history.push(listRoute)} disabled={saving}>Hủy</Button>
      </div>
      {Array.isArray(preview.notFoundIds) && preview.notFoundIds.length > 0 && (
        <Alert className="mb-3" type="warning" showIcon message={`Không tìm thấy ID: ${preview.notFoundIds.join(', ')}`} />
      )}
      {entity === 'student' ? (
        <Card bodyStyle={{ padding: 0 }}>
          <div className="p-3">
            <Search
              allowClear
              placeholder="Tìm kiếm bản sao Sinh viên..."
              value={search}
              onChange={event => {
                setSearch(event.target.value)
                setTablePagination(current => ({ ...current, current: 1 }))
              }}
            />
          </div>
          <Table
            rowKey="draftKey"
            dataSource={studentPreviewDrafts}
            columns={studentColumns}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: tablePagination.current,
              pageSize: tablePagination.pageSize,
              pageSizeOptions: ['10', '20', '50', '100'],
              showSizeChanger: true,
              showTotal: total => `Tổng ${total} bản sao Sinh viên`,
              onChange: (current, pageSize) => setTablePagination({ current, pageSize }),
            }}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {drafts.map(draft => (
            <Col xs={24} lg={12} key={draft.draftKey}>
              <Card
                title={<span>Bản sao lớp <Tag color="blue">{draft.values.code || draft.values.name || draft.sourceId}</Tag></span>}
                extra={<Button icon={<EditOutlined />} onClick={() => openEditor(draft)} disabled={saving}>Chỉnh sửa</Button>}
              >
                <Descriptions column={1} size="small">
                  {fields.map(([key, label]) => (
                    <Descriptions.Item key={key} label={label}>{draft.values[key] || '-'}</Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <div className="mt-4 d-flex justify-content-end">
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={commit}>
          {drafts.length === 1 ? 'Lưu bản sao' : `Lưu tất cả bản sao (${drafts.length})`}
        </Button>
      </div>
      <Modal
        visible={Boolean(editingDraft)}
        title={editingDraft ? `Chỉnh sửa ${editingDraft.values.code || editingDraft.values.fullname || 'bản sao'}` : 'Chỉnh sửa draft'}
        okText="Áp dụng vào draft"
        cancelText="Hủy"
        onOk={saveLocalDraft}
        onCancel={() => setEditingDraftKey(null)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {entity === 'class' && <>
            <Form.Item name="code" label="Mã lớp" rules={[{ required: true, whitespace: true, max: 50 }]}><Input maxLength={50} /></Form.Item>
            <Form.Item name="name" label="Tên lớp" rules={[{ required: true, whitespace: true, max: 255 }]}><Input maxLength={255} /></Form.Item>
            <Form.Item name="description" label="Mô tả"><TextArea rows={4} /></Form.Item>
          </>}
          {entity === 'student' && <>
            <Form.Item name="code" label="Mã sinh viên" rules={[{ required: true, whitespace: true, max: 50 }]}><Input maxLength={50} /></Form.Item>
            <Form.Item name="fullname" label="Họ tên" rules={[{ required: true, whitespace: true, max: 30 }]}><Input maxLength={30} /></Form.Item>
            <Form.Item name="dob" label="Ngày sinh"><Input type="date" /></Form.Item>
            <Form.Item name="sex" label="Giới tính">
              <Radio.Group>
                <Radio value={true}>Nam</Radio>
                <Radio value={false}>Nữ</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true, whitespace: true, max: 50 }]}><Input maxLength={50} /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', max: 256 }]}><Input maxLength={256} /></Form.Item>
            <Form.Item name="class_id" label="ID lớp"><Input /></Form.Item>
            <Form.Item name="hobbies" label="Bitmask sở thích"><Input /></Form.Item>
            <Form.Item name="homecity" label="Quê quán"><Input maxLength={100} /></Form.Item>
            <Form.Item name="address" label="Địa chỉ"><Input maxLength={100} /></Form.Item>
            <Form.Item name="hair_color" label="Màu tóc"><Input maxLength={7} /></Form.Item>
            <Form.Item name="facebook" label="Facebook"><Input maxLength={256} /></Form.Item>
            <Form.Item name="description" label="Mô tả"><TextArea rows={3} /></Form.Item>
            <Form.Item label="Ảnh mới">
              <Upload
                beforeUpload={file => {
                  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                    Modal.error({ title: 'Ảnh không hợp lệ', content: 'Chỉ nhận JPG/JPEG/PNG, tối đa 5MB.' })
                    return Upload.LIST_IGNORE
                  }
                  setAttachmentFiles(current => ({ ...current, [editingDraftKey]: file }))
                  return false
                }}
                onRemove={() => setAttachmentFiles(current => {
                  const next = { ...current }
                  delete next[editingDraftKey]
                  return next
                })}
                fileList={attachmentFiles[editingDraftKey] ? [attachmentFiles[editingDraftKey]] : []}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Chọn ảnh mới</Button>
              </Upload>
            </Form.Item>
          </>}
        </Form>
      </Modal>
    </div>
  )
}

export default CopyPreviewPage
