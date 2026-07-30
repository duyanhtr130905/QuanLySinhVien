import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { useHistory, useLocation } from 'react-router-dom'
import HobbyService from 'services/HobbyService'
import StudentService from 'services/StudentService'

const { TextArea } = Input
const { Option } = Select

const apiData = response => response?.data || response || {}
const validationInput = drafts => drafts.map(({ draftKey, rowNumber, values }) => ({ draftKey, rowNumber, values }))

const StudentImportPreview = () => {
  const history = useHistory()
  const location = useLocation()
  const initial = location.state?.preview
  const [drafts, setDrafts] = useState(() => initial?.rows || [])
  const [validating, setValidating] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [editingKey, setEditingKey] = useState(null)
  const [hobbyName, setHobbyName] = useState(null)
  const [creatingHobby, setCreatingHobby] = useState(false)
  const [search, setSearch] = useState('')
  const request = useRef(0)
  const [form] = Form.useForm()
  const validationKey = useMemo(() => drafts.map(draft => JSON.stringify(draft.values || {})).join('|'), [drafts])

  useEffect(() => {
    if (!initial || !drafts.length) return undefined
    const id = ++request.current
    setValidating(true)
    setDrafts(current => current.map(draft => ({ ...draft, status: 'validating' })))
    const timer = setTimeout(async () => {
      try {
        const response = await StudentService.validateImportDrafts(validationInput(drafts))
        if (id === request.current) setDrafts(apiData(response).rows || [])
      } catch (_) {
        if (id === request.current) setDrafts(current => current.map(draft => ({
          ...draft,
          status: 'invalid',
          errors: { general: 'Không thể kiểm tra dữ liệu import' },
        })))
      } finally {
        if (id === request.current) setValidating(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [initial, validationKey])

  const invalid = drafts.some(draft => draft.status !== 'valid')
  const errorsFor = draft => draft.fieldErrors || draft.errors || {}
  const openEdit = draft => {
    const values = draft.values || {}
    setEditingKey(draft.draftKey)
    form.setFieldsValue({ ...values, hobbies: Array.isArray(values.hobbies) ? values.hobbies.join('; ') : values.hobbies })
    form.setFields(Object.entries(errorsFor(draft)).map(([name, error]) => ({ name, errors: [error] })))
  }
  const applyEdit = async () => {
    const values = await form.validateFields()
    setDrafts(current => current.map(draft => draft.draftKey === editingKey
      ? { ...draft, values: { ...draft.values, ...values }, status: 'validating', errors: {}, fieldErrors: {} }
      : draft))
    setEditingKey(null)
  }
  const createHobby = async () => {
    if (!hobbyName || creatingHobby) return
    setCreatingHobby(true)
    setValidating(true)
    const id = ++request.current
    try {
      await HobbyService.create(hobbyName.trim())
      const response = await StudentService.validateImportDrafts(validationInput(drafts))
      if (id === request.current) setDrafts(apiData(response).rows || [])
      setHobbyName(null)
      message.success('Đã tạo Hobby và kiểm tra lại các dòng')
    } catch (error) {
      message.error(error?.response?.data?.message || 'Không thể tạo Hobby; dữ liệu preview vẫn được giữ nguyên')
    } finally {
      if (id === request.current) setCreatingHobby(false)
      if (id === request.current) setValidating(false)
    }
  }
  const commit = async () => {
    if (invalid || validating || committing) return
    setCommitting(true)
    try {
      const data = apiData(await StudentService.commitImportDrafts(validationInput(drafts)))
      message.success(`Đã lưu ${(data.created || []).length} tạo mới và ${(data.updated || []).length} cập nhật`)
      history.replace('/app/student/list')
    } catch (error) {
      const failedRows = error?.response?.data?.data?.rows
      if (Array.isArray(failedRows)) {
        setDrafts(current => current.map(draft => {
          const failed = failedRows.find(row => row.draftKey === draft.draftKey)
          return failed ? { ...draft, ...failed, values: draft.values } : draft
        }))
      }
      message.error(error?.response?.data?.message || 'Không thể lưu import; dữ liệu preview vẫn được giữ lại')
    } finally {
      setCommitting(false)
    }
  }

  const filtered = useMemo(() => drafts.filter(draft => {
    const values = draft.values || {}
    return `${values.code || ''} ${values.fullname || ''} ${values.email || ''}`.toLowerCase().includes(search.toLowerCase())
  }), [drafts, search])
  const columns = [
    { title: 'Dòng', dataIndex: 'rowNumber', width: 70 },
    { title: 'Chế độ', dataIndex: 'mode', render: value => <Tag color={value === 'create' ? 'blue' : 'green'}>{value === 'create' ? 'Tạo mới' : 'Cập nhật'}</Tag> },
    { title: 'Mã Sinh viên', dataIndex: ['values', 'code'] },
    { title: 'Họ tên', dataIndex: ['values', 'fullname'] },
    { title: 'Email', dataIndex: ['values', 'email'] },
    { title: 'Tài khoản', dataIndex: ['values', 'username'] },
    { title: 'Lớp', dataIndex: ['values', 'class'] },
    { title: 'Sở thích', dataIndex: ['values', 'hobbies'], render: value => (Array.isArray(value) ? value : []).join('; ') || '-' },
    {
      title: 'Trạng thái',
      render: (_, row) => row.status === 'validating'
        ? <Tag color="processing">Đang kiểm tra</Tag>
        : row.status === 'valid'
          ? <Tag color="success">Hợp lệ</Tag>
          : <Tag color="error">Cần chỉnh sửa: {Object.values(errorsFor(row)).join(' • ')}</Tag>,
    },
    { title: 'Hành động', render: (_, row) => <Button onClick={() => openEdit(row)}>Chỉnh sửa</Button> },
  ]
  if (!initial) return <Button onClick={() => history.replace('/app/student/import')}>Quay lại Import</Button>
  const editing = drafts.find(draft => draft.draftKey === editingKey)
  const missing = [...new Set(drafts.flatMap(draft => draft.missingHobbies || []))]
  return <div>
    <h1>Xem trước nhập dữ liệu Sinh viên</h1>
    <Input.Search placeholder="Tìm draft..." value={search} onChange={event => setSearch(event.target.value)} className="mb-3" />
    {missing.map(name => <Button key={name} className="mr-2 mb-2" onClick={() => setHobbyName(name)}>Thêm nhanh Hobby: {name}</Button>)}
    <Table rowKey="draftKey" dataSource={filtered} columns={columns} pagination={{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }} />
    <Button type="primary" disabled={invalid || validating || committing} loading={committing || validating} onClick={commit}>Lưu tất cả ({drafts.length})</Button>
    <Modal visible={Boolean(editing)} title="Chỉnh sửa dòng import" onOk={applyEdit} onCancel={() => setEditingKey(null)} okText="Áp dụng thay đổi">
      <Form form={form} layout="vertical">
        <Form.Item name="code" label="Mã" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="fullname" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="dob" label="Ngày sinh (DD/MM/YYYY)"><Input /></Form.Item>
        <Form.Item name="gender" label="Giới tính"><Select allowClear><Option value="Nam">Nam</Option><Option value="Nữ">Nữ</Option></Select></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <Form.Item name="username" label="Tài khoản" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="password" label="Password"><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="class" label="Mã lớp"><Input /></Form.Item>
        <Form.Item name="hobbies" label="Sở thích"><Input /></Form.Item>
        <Form.Item name="homecity" label="Thành phố"><Input /></Form.Item>
        <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
        <Form.Item name="hair_color" label="Màu tóc"><Input /></Form.Item>
        <Form.Item name="facebook" label="Facebook"><Input /></Form.Item>
        <Form.Item name="description" label="Mô tả"><TextArea /></Form.Item>
      </Form>
    </Modal>
    <Modal visible={Boolean(hobbyName)} title="Thêm nhanh Hobby" onOk={createHobby} confirmLoading={creatingHobby} onCancel={() => setHobbyName(null)}>
      <Input value={hobbyName || ''} onChange={event => setHobbyName(event.target.value)} />
    </Modal>
  </div>
}

export default StudentImportPreview
