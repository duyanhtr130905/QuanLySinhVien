import React, { useEffect, useState } from 'react'
import { Prompt, useHistory, useLocation } from 'react-router-dom'
import { Alert, Breadcrumb, Button, Card, Col, Descriptions, Form, Input, Modal, Radio, Result, Row, Tag, Upload } from 'antd'
import { EditOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons'

const { TextArea } = Input

const studentFields = [
  ['code', 'Mã sinh viên'], ['fullname', 'Họ tên'], ['username', 'Username'], ['email', 'Email'],
  ['class_id', 'Lớp'], ['hobbies', 'Sở thích'], ['dob', 'Ngày sinh'], ['sex', 'Giới tính'],
  ['homecity', 'Quê quán'], ['address', 'Địa chỉ'], ['hair_color', 'Màu tóc'],
  ['facebook', 'Facebook'], ['description', 'Mô tả'], ['attachment', 'Ảnh đính kèm'],
]
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
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(null)
  const [attachmentFiles, setAttachmentFiles] = useState({})
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
      if (!dirty || completed) return undefined
      event.preventDefault()
      event.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [completed, dirty])

  const openEditor = draft => {
    setEditing(draft)
    form.setFieldsValue(draft.values)
  }

  const saveLocalDraft = () => {
    form.validateFields().then(values => {
      setDrafts(current => current.map(draft => (
        draft.draftKey === editing.draftKey
          ? { ...draft, values: { ...draft.values, ...values } }
          : draft
      )))
      setEditing(null)
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
      const response = await service.commitCopyDrafts(payload)
      setCompleted(response?.data || response)
    } catch (error) {
      Modal.error({
        title: 'Không thể lưu bản sao',
        content: error?.response?.data?.message || error?.message || 'Vui lòng kiểm tra lại dữ liệu và thử lại.',
      })
    } finally {
      setSaving(false)
    }
  }

  const fields = entity === 'student' ? studentFields : classFields
  const title = entity === 'student' ? 'Xem trước bản sao Sinh viên' : 'Xem trước bản sao Lớp'
  const plural = entity === 'student' ? 'sinh viên' : 'lớp'

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

  if (completed) {
    const created = Array.isArray(completed.created) ? completed.created : []
    return (
      <Result
        status="success"
        title={`Đã lưu ${created.length} bản sao ${plural}`}
        subTitle="Các thay đổi trong draft đã được ghi nhận."
        extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về danh sách</Button>}
      />
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
      <Row gutter={[16, 16]}>
        {drafts.map(draft => (
          <Col xs={24} lg={12} key={draft.draftKey}>
            <Card
              title={<span>Draft <Tag color="blue">{draft.draftKey}</Tag></span>}
              extra={<Button icon={<EditOutlined />} onClick={() => openEditor(draft)} disabled={saving}>Chỉnh sửa</Button>}
            >
              <Descriptions column={1} size="small">
                {fields.map(([key, label]) => (
                  <Descriptions.Item key={key} label={label}>{draft.values[key] || '-'}</Descriptions.Item>
                ))}
              </Descriptions>
              {entity === 'student' && <small>Mật khẩu không được hiển thị và sẽ giữ hash của bản ghi gốc.</small>}
            </Card>
          </Col>
        ))}
      </Row>
      <div className="mt-4 d-flex justify-content-end">
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={commit}>Lưu tất cả ({drafts.length})</Button>
      </div>
      <Modal
        visible={Boolean(editing)}
        title={editing ? `Chỉnh sửa ${editing.draftKey}` : 'Chỉnh sửa draft'}
        okText="Áp dụng vào draft"
        cancelText="Hủy"
        onOk={saveLocalDraft}
        onCancel={() => setEditing(null)}
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
                  setAttachmentFiles(current => ({ ...current, [editing.draftKey]: file }))
                  return false
                }}
                onRemove={() => setAttachmentFiles(current => {
                  const next = { ...current }
                  delete next[editing.draftKey]
                  return next
                })}
                fileList={attachmentFiles[editing?.draftKey] ? [attachmentFiles[editing.draftKey]] : []}
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
