import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useHistory, useLocation, useParams } from 'react-router-dom'
import {
  Breadcrumb, Button, Card, Form, Input, message, Modal, Result, Skeleton,
} from 'antd'
import { LockOutlined } from '@ant-design/icons'
import {
  clearClassDetail, createClass, fetchClassDetail, updateClass,
} from 'redux/actions/Class'
import {
  getChangedClassFields, hasCopiedClassReference, normalizeClassFormValues,
} from '../classUtils'
import '../Class.css'

const { TextArea } = Input

const requiredTrimmedRule = (label, max) => ({
  validator: (_, value) => {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (!normalized) return Promise.reject(new Error(`Vui lòng nhập ${label}`))
    if (normalized.length > max) {
      return Promise.reject(new Error(`${label} không được vượt quá ${max} ký tự`))
    }
    return Promise.resolve()
  },
})

const ClassForm = ({ mode = 'create' }) => {
  const isCreate = mode === 'create'
  const isCopy = mode === 'copy'
  const isRecordEdit = !isCreate
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const { id: routeId } = useParams()
  const [form] = Form.useForm()
  const numericId = Number(routeId)
  const validRouteId = /^\d+$/.test(String(routeId)) &&
    Number.isSafeInteger(numericId) &&
    numericId > 0
  const copiedClass = isCopy && Number(location.state?.copiedClass?.id) === numericId
    ? location.state.copiedClass
    : null
  const hasCopyReference = !isCopy || Boolean(copiedClass) || (
    validRouteId && hasCopiedClassReference(numericId)
  )
  const validId = !isRecordEdit || (validRouteId && hasCopyReference)
  const detail = useSelector(state => state.classroom.detail)
  const detailLoading = useSelector(state => state.classroom.detailLoading)
  const detailError = useSelector(state => state.classroom.detailError)
  const submitting = useSelector(state => (
    isCreate ? state.classroom.createLoading : state.classroom.updateLoading
  ))
  const [dirty, setDirty] = useState(false)
  const [submitMode, setSubmitMode] = useState(null)
  const initializedIdRef = useRef(null)
  const initialValuesRef = useRef(null)
  const listState = location.state?.classListState
  const listRoute = {
    pathname: '/app/class/list',
    state: listState ? { classListState: listState } : undefined,
  }
  const copyResultRoute = {
    pathname: '/app/class/copy-result',
    state: listState ? { classListState: listState } : undefined,
  }
  const cancelRoute = isCopy && location.state?.copyResultReturn
    ? copyResultRoute
    : listRoute
  const formRecord = copiedClass || detail

  useEffect(() => {
    if (!isRecordEdit || !validId || copiedClass) return undefined
    dispatch(fetchClassDetail(numericId))
    return () => dispatch(clearClassDetail())
  }, [copiedClass, dispatch, isRecordEdit, numericId, validId])

  useEffect(() => {
    if (!isRecordEdit || !formRecord || Number(formRecord.id) !== numericId) return
    if (initializedIdRef.current === numericId) return
    const values = normalizeClassFormValues(formRecord)
    form.setFieldsValue(values)
    initialValuesRef.current = values
    initializedIdRef.current = numericId
    setDirty(false)
  }, [form, formRecord, isRecordEdit, numericId])

  const applyBackendError = error => {
    const text = error?.message || 'Không thể lưu lớp'
    if (error?.code === 'E603' || error?.code === 'F603' || /code|mã lớp/i.test(text)) {
      form.setFields([{ name: 'code', errors: [text] }])
    } else {
      message.error(text)
    }
  }

  const resetCreateForm = () => {
    form.resetFields()
    initialValuesRef.current = null
    setDirty(false)
    setSubmitMode(null)
  }

  const handleSubmit = continueAfterCreate => {
    if (submitting) return
    setSubmitMode(continueAfterCreate ? 'continue' : (isCreate ? 'create' : 'save'))
    form.validateFields()
      .then(values => {
        const normalized = normalizeClassFormValues(values)
        if (isCreate) {
          dispatch(createClass(
            normalized,
            () => {
              message.success('Thêm mới lớp thành công')
              if (continueAfterCreate) {
                resetCreateForm()
              } else {
                setDirty(false)
                history.push(listRoute)
              }
            },
            error => {
              setSubmitMode(null)
              applyBackendError(error)
            }
          ))
          return
        }

        const changedFields = getChangedClassFields(initialValuesRef.current, normalized)
        if (!Object.keys(changedFields).length) {
          setSubmitMode(null)
          message.info('Không có thay đổi để lưu.')
          return
        }

        dispatch(updateClass(
          numericId,
          changedFields,
          () => {
            setDirty(false)
            message.success(isCopy ? 'Lưu bản sao lớp thành công' : 'Cập nhật lớp thành công')
            history.push(cancelRoute)
          },
          error => {
            setSubmitMode(null)
            applyBackendError(error)
          }
        ))
      })
      .catch(error => {
        setSubmitMode(null)
        const firstField = error?.errorFields?.[0]?.name
        if (firstField) form.scrollToField(firstField)
      })
  }

  const leavePage = () => history.push(cancelRoute)

  const handleCancel = () => {
    if (submitting) return
    if (!dirty) {
      leavePage()
      return
    }
    Modal.confirm({
      title: isCreate ? 'Hủy thêm mới lớp?' : 'Hủy chỉnh sửa lớp?',
      content: 'Các thay đổi chưa được lưu. Bạn có chắc chắn muốn rời khỏi trang?',
      okText: 'Rời trang',
      cancelText: 'Ở lại',
      onOk: leavePage,
    })
  }

  const renderLoadState = () => {
    if (!isRecordEdit) return null
    if (!validId) {
      return (
        <Card>
          <Result
            status="warning"
            title={validRouteId
              ? 'Không có dữ liệu bản sao hợp lệ để hiệu chỉnh.'
              : 'ID lớp không hợp lệ.'}
            extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
          />
        </Card>
      )
    }
    if (!copiedClass && detailError) {
      return (
        <Card>
          <Result
            status={Number(detailError.status) === 404 ? 'warning' : 'error'}
            title={detailError.message || 'Không thể tải dữ liệu lớp.'}
            extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về Danh sách Lớp</Button>}
          />
        </Card>
      )
    }
    if (!copiedClass && (
      detailLoading || !formRecord || Number(formRecord.id) !== numericId
    )) {
      return <Card className="class-form-card"><Skeleton active paragraph={{ rows: 5 }} /></Card>
    }
    return null
  }

  const loadState = renderLoadState()
  const title = isCreate
    ? 'Thêm mới Lớp'
    : isCopy
      ? 'Sao chép thành công Lớp'
      : 'Chỉnh sửa Lớp'
  const breadcrumbTitle = isCreate ? 'Thêm mới' : isCopy ? 'Sao chép' : 'Chỉnh sửa'

  return (
    <div className="class-form-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Danh mục Lớp</Link></Breadcrumb.Item>
        <Breadcrumb.Item>{breadcrumbTitle}</Breadcrumb.Item>
      </Breadcrumb>
      <h1>{title}</h1>

      {loadState || (
        <Card className="class-form-card">
          <Form
            form={form}
            layout="vertical"
            initialValues={{ code: '', name: '', description: '' }}
            onValuesChange={() => setDirty(true)}
          >
            <Form.Item
              name="code"
              label="Mã lớp"
              rules={[requiredTrimmedRule('mã lớp', 50)]}
            >
              <Input
                maxLength={50}
                disabled={isRecordEdit}
                suffix={isRecordEdit ? <LockOutlined /> : null}
                placeholder="Nhập mã lớp"
              />
            </Form.Item>
            <Form.Item
              name="name"
              label="Tên lớp"
              rules={[requiredTrimmedRule('tên lớp', 255)]}
            >
              <Input maxLength={255} placeholder="Nhập tên lớp" />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <TextArea rows={5} placeholder="Nhập mô tả lớp (không bắt buộc)" />
            </Form.Item>

            <div className="class-form-actions">
              <Button disabled={submitting} onClick={handleCancel}>Hủy bỏ</Button>
              {isCreate && (
                <Button
                  disabled={submitting}
                  loading={submitting && submitMode === 'continue'}
                  onClick={() => handleSubmit(true)}
                >
                  Thêm mới và tiếp tục
                </Button>
              )}
              <Button
                type="primary"
                disabled={submitting}
                loading={submitting && submitMode !== 'continue'}
                onClick={() => handleSubmit(false)}
              >
                {isCreate ? 'Thêm mới' : 'Lưu'}
              </Button>
            </div>
          </Form>
        </Card>
      )}
    </div>
  )
}

export default ClassForm
