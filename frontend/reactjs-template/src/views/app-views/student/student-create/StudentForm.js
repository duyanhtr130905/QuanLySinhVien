import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useHistory, useLocation, useParams } from 'react-router-dom'
import {
  Breadcrumb, Button, Card, Col, DatePicker, Form, Input, message, Modal,
  Radio, Result, Row, Select, Skeleton, Spin, Tooltip, Upload
} from 'antd'
import {
  DeleteOutlined, LockOutlined, PlusOutlined, UploadOutlined
} from '@ant-design/icons'
import moment from 'moment'
import ColorPicker from 'components/shared-components/ColorPicker'
import ClassService from 'services/ClassService'
import HobbyService from 'services/HobbyService'
import {
  clearStudentDetail, createStudent, fetchStudentDetail, updateStudent
} from 'redux/actions/Student'
import {
  decodeHobbyBitmask, encodeHobbyBitmask, isPositivePowerOfTwo
} from './studentFormUtils'
import {
  getSafeHttpUrl, normalizeStudentDate as normalizeDate,
  normalizeStudentSex as normalizeSex, unwrapCollection
} from '../studentUtils'
import { hasStoredCopyReference } from '../student-copy/copyUtils'
import { normalizeClassFormValues } from '../../class/classUtils'
import './StudentCreate.css'

const { Option } = Select
const { TextArea } = Input

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png']
const EMAIL_PATTERN = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/
const FACEBOOK_PATTERN = /^https?:\/\/[0-9a-zA-Z.\-_]+$/
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/
const FIELD_NAMES = [
  'code', 'fullname', 'dob', 'sex', 'class_id', 'homecity', 'address',
  'hobbies', 'description', 'hair_color', 'email', 'facebook',
  'username', 'password'
]

const trim = value => typeof value === 'string' ? value.trim() : value

const getOptionLabel = item => (
  item.name || item.hobby_name || item.class_name || item.title || item.code || String(item.id)
)

const getClassOptionLabel = item => {
  const name = item.name || item.class_name || item.className
  if (item.code && name) return `${item.code} - ${name}`
  return name || item.code || String(item.id)
}

const sortClasses = values => [...values].sort((left, right) => (
  getClassOptionLabel(left).localeCompare(getClassOptionLabel(right), 'vi')
))

const getErrorText = value => {
  if (Array.isArray(value)) return value.map(getErrorText).filter(Boolean).join(', ')
  if (typeof value === 'string') return value
  if (value && typeof value.message === 'string') return value.message
  return ''
}

const EDITABLE_FIELDS = [
  'fullname', 'dob', 'sex', 'class_id', 'homecity', 'address', 'hobbies',
  'description', 'hair_color', 'email', 'facebook'
]

const normalizeClassId = value => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const normalizeValues = (values, allowedHobbyBits) => ({
  fullname: trim(values.fullname || ''),
  dob: normalizeDate(values.dob),
  sex: normalizeSex(values.sex),
  class_id: normalizeClassId(values.class_id),
  homecity: trim(values.homecity || ''),
  address: trim(values.address || ''),
  hobbies: encodeHobbyBitmask(values.hobbies || [], allowedHobbyBits),
  description: trim(values.description || ''),
  hair_color: trim(values.hair_color || '').toUpperCase(),
  email: trim(values.email || '').toLowerCase(),
  facebook: trim(values.facebook || ''),
})

const StudentForm = ({ mode = 'create' }) => {
  const isEdit = mode === 'edit'
  const isCopy = mode === 'copy'
  const isRecordEdit = isEdit || isCopy
  const { id: routeId } = useParams()
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const [form] = Form.useForm()
  const [hobbyForm] = Form.useForm()
  const [classForm] = Form.useForm()
  const submitting = useSelector(state => (
    isRecordEdit ? state.student.updateLoading : state.student.createLoading
  ))
  const detail = useSelector(state => state.student.detail)
  const detailLoading = useSelector(state => state.student.detailLoading)
  const detailError = useSelector(state => state.student.detailError)
  const numericId = Number(routeId)
  const copiedStudent = isCopy &&
    Number(location.state?.copiedStudent?.id) === numericId
    ? location.state.copiedStudent
    : null
  const formDetail = copiedStudent || detail
  const validRouteId = (
    /^\d+$/.test(String(routeId)) && Number.isSafeInteger(numericId) && numericId > 0
  )
  const hasCopyReference = !isCopy || Boolean(copiedStudent) || (
    validRouteId && hasStoredCopyReference(numericId)
  )
  const validId = !isRecordEdit || (validRouteId && hasCopyReference)
  const listRoute = {
    pathname: '/app/student/list',
    state: location.state?.studentListState
      ? { studentListState: location.state.studentListState }
      : undefined,
  }
  const detailRoute = {
    pathname: `/app/student/detail/${numericId}`,
    state: location.state,
  }
  const copyResultRoute = {
    pathname: '/app/student/copy-result',
    state: location.state?.studentListState
      ? { studentListState: location.state.studentListState }
      : undefined,
  }
  const postSaveRoute = isCopy && location.state?.copyResultReturn
    ? copyResultRoute
    : detailRoute
  const cancelRoute = isEdit
    ? listRoute
    : (isCopy && location.state?.copyResultReturn ? copyResultRoute : detailRoute)
  const codeInputRef = useRef(null)
  const previewUrlRef = useRef('')
  const initializedIdRef = useRef(null)
  const initialSnapshotRef = useRef(null)

  const [classes, setClasses] = useState([])
  const [hobbyOptions, setHobbyOptions] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingHobbies, setLoadingHobbies] = useState(false)
  const [hobbiesLoaded, setHobbiesLoaded] = useState(false)
  const [classLoadError, setClassLoadError] = useState(false)
  const [hobbyLoadError, setHobbyLoadError] = useState(false)
  const [selectedHobbyBits, setSelectedHobbyBits] = useState([])
  const [hairColor, setHairColor] = useState(isRecordEdit ? '' : '#000000')
  const [attachment, setAttachment] = useState(null)
  const [currentAttachmentUrl, setCurrentAttachmentUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [submitMode, setSubmitMode] = useState(null)
  const [hobbyModalVisible, setHobbyModalVisible] = useState(false)
  const [creatingHobby, setCreatingHobby] = useState(false)
  const [classModalVisible, setClassModalVisible] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)

  const replacePreviewUrl = nextUrl => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
  }

  const clearAttachment = () => {
    replacePreviewUrl('')
    setAttachment(null)
    setPreviewFailed(false)
    setAttachmentError('')
  }

  const loadClasses = () => {
    setLoadingClasses(true)
    setClassLoadError(false)
    ClassService.getAll()
      .then(response => setClasses(sortClasses(unwrapCollection(response))))
      .catch(() => {
        setClasses([])
        setClassLoadError(true)
        message.error('Không tải được danh sách lớp')
      })
      .finally(() => setLoadingClasses(false))
  }

  const loadHobbies = () => {
    setLoadingHobbies(true)
    setHobbiesLoaded(false)
    setHobbyLoadError(false)
    HobbyService.getAll()
      .then(response => {
        const validOptions = unwrapCollection(response).filter(item => {
          const activeKey = ['is_active', 'active', 'status']
            .find(key => Object.prototype.hasOwnProperty.call(item, key))
          const activeValue = activeKey ? item[activeKey] : undefined
          const isActive = activeValue === undefined || (
            activeValue === true ||
            activeValue === 1 ||
            ['1', 'true', 'active'].includes(String(activeValue).toLowerCase())
          )
          return isActive && isPositivePowerOfTwo(item.bit_value)
        })
        setHobbyOptions(validOptions)
      })
      .catch(() => {
        setHobbyOptions([])
        setHobbyLoadError(true)
        message.error('Không tải được danh sách sở thích')
      })
      .finally(() => {
        setLoadingHobbies(false)
        setHobbiesLoaded(true)
      })
  }

  useEffect(() => {
    loadClasses()
    loadHobbies()
    if (!isRecordEdit) codeInputRef.current?.focus()

    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRecordEdit) return undefined
    initializedIdRef.current = null
    initialSnapshotRef.current = null
    clearAttachment()
    setCurrentAttachmentUrl('')
    setDirty(false)
    dispatch(clearStudentDetail())
    if (validId) dispatch(fetchStudentDetail(numericId))
    return () => dispatch(clearStudentDetail())
  }, [dispatch, isRecordEdit, numericId, validId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      !isRecordEdit || !validId || !hobbiesLoaded || !formDetail ||
      Number(formDetail.id) !== numericId || initializedIdRef.current === numericId
    ) return

    const activeHobbyBits = hobbyOptions.map(item => Number(item.bit_value))
    const selected = decodeHobbyBitmask(formDetail.hobbies, hobbyOptions)
      .map(item => Number(item.bit_value))
    const dateValue = normalizeDate(formDetail.dob)
    const initialValues = {
      code: formDetail.code || '',
      fullname: formDetail.fullname || '',
      dob: dateValue ? moment(dateValue, 'YYYY-MM-DD', true) : null,
      sex: normalizeSex(formDetail.sex),
      class_id: normalizeClassId(formDetail.class_id),
      homecity: formDetail.homecity || '',
      address: formDetail.address || '',
      hobbies: selected,
      description: formDetail.description || '',
      hair_color: trim(formDetail.hair_color || '').toUpperCase(),
      email: formDetail.email || '',
      facebook: formDetail.facebook || '',
      username: formDetail.username || '',
      password: '',
    }
    form.setFieldsValue(initialValues)
    setSelectedHobbyBits(selected)
    setHairColor(initialValues.hair_color)
    setCurrentAttachmentUrl(getSafeHttpUrl(formDetail.attachment))
    setPreviewFailed(false)
    initialSnapshotRef.current = normalizeValues(initialValues, activeHobbyBits)
    initializedIdRef.current = numericId
    setDirty(false)
  }, [form, formDetail, hobbiesLoaded, hobbyOptions, isRecordEdit, numericId, validId])

  const handleAttachment = file => {
    const extension = file.name.split('.').pop().toLowerCase()
    const isValidType = (
      ['image/jpeg', 'image/png'].includes(file.type) &&
      VALID_IMAGE_EXTENSIONS.includes(extension)
    )

    if (!isValidType) {
      setAttachmentError('Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG.')
      message.error('Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG.')
      return false
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setAttachmentError('Dung lượng ảnh không được vượt quá 5MB.')
      message.error('Dung lượng ảnh không được vượt quá 5MB.')
      return false
    }

    setAttachment(file)
    setPreviewFailed(false)
    setAttachmentError('')
    replacePreviewUrl(URL.createObjectURL(file))
    setDirty(true)
    return false
  }

  const removeAttachment = () => {
    clearAttachment()
    setDirty(true)
  }

  const handleColorChange = value => {
    const nextColor = value?.hex ? value.hex.toUpperCase() : ''
    setHairColor(nextColor)
    form.setFieldsValue({ hair_color: nextColor })
    setDirty(true)
  }

  const closeHobbyModal = () => {
    if (creatingHobby) return
    setHobbyModalVisible(false)
    hobbyForm.resetFields()
  }

  const closeClassModal = () => {
    if (creatingClass) return
    setClassModalVisible(false)
    classForm.resetFields()
  }

  const handleCreateClass = () => {
    if (creatingClass) return
    setCreatingClass(true)
    classForm.validateFields()
      .then(async values => {
        const normalized = normalizeClassFormValues(values)
        try {
          const response = await ClassService.create(normalized)
          const payload = response?.data || response
          const id = normalizeClassId(typeof payload === 'object'
            ? (payload?.id || payload?.data?.id || payload?.class?.id)
            : payload)
          if (!id) throw new Error('Không nhận được ID của lớp mới')

          let createdClass = payload
          if (!payload?.name && !payload?.class_name && !payload?.className) {
            const detailResponse = await ClassService.getById(id)
            createdClass = detailResponse?.data || detailResponse
          }
          setClasses(current => sortClasses([
            ...current.filter(item => Number(item.id) !== id),
            { ...createdClass, id },
          ]))
          form.setFieldsValue({ class_id: id })
          setDirty(true)
          setClassModalVisible(false)
          classForm.resetFields()
          message.success('Thêm lớp thành công')
        } catch (error) {
          const errorMessage = error?.response?.data?.message || error?.message || 'Không thể thêm lớp'
          const errorCode = error?.response?.data?.code || error?.code
          const normalizedMessage = errorMessage.toLowerCase()
          if (errorCode === 'E603' || errorCode === 'F603' || /code|mã lớp/.test(normalizedMessage)) {
            classForm.setFields([{ name: 'code', errors: [errorMessage] }])
          } else if (/name|tên lớp/.test(normalizedMessage)) {
            classForm.setFields([{ name: 'name', errors: [errorMessage] }])
          } else {
            message.error(errorMessage)
          }
        } finally {
          setCreatingClass(false)
        }
      })
      .catch(() => setCreatingClass(false))
  }

  const handleCreateHobby = () => {
    if (creatingHobby) return

    hobbyForm.validateFields()
      .then(({ name }) => {
        const normalizedName = trim(name)
        setCreatingHobby(true)
        HobbyService.create(normalizedName)
          .then(response => {
            const createdHobby = response?.data || response
            if (!createdHobby || !isPositivePowerOfTwo(createdHobby.bit_value)) {
              throw new Error('Dữ liệu sở thích vừa tạo không hợp lệ')
            }

            const bitValue = Number(createdHobby.bit_value)
            setHobbyOptions(current => (
              [...current.filter(item => Number(item.bit_value) !== bitValue), createdHobby]
                .sort((left, right) => Number(left.bit_value) - Number(right.bit_value))
            ))
            setSelectedHobbyBits(current => {
              const nextValues = [...new Set([...current, bitValue])]
              form.setFieldsValue({ hobbies: nextValues })
              return nextValues
            })
            setDirty(true)
            setHobbyModalVisible(false)
            hobbyForm.resetFields()
            message.success('Thêm sở thích thành công')
          })
          .catch(error => {
            const errorMessage = error.response?.data?.message || error.message || 'Không thể thêm sở thích'
            hobbyForm.setFields([{ name: 'name', errors: [errorMessage] }])
          })
          .finally(() => setCreatingHobby(false))
      })
      .catch(() => {})
  }

  const buildFormData = values => {
    const formData = new FormData()

    formData.append('code', trim(values.code))
    formData.append('fullname', trim(values.fullname))
    formData.append('email', trim(values.email).toLowerCase())
    formData.append('username', trim(values.username))
    formData.append('password', values.password)
    const activeHobbyBits = hobbyOptions.map(item => Number(item.bit_value))
    formData.append(
      'hobbies',
      String(encodeHobbyBitmask(values.hobbies || selectedHobbyBits, activeHobbyBits))
    )

    if (values.dob) formData.append('dob', values.dob.format('YYYY-MM-DD'))
    if (values.sex !== undefined && values.sex !== null) {
      formData.append('sex', String(values.sex))
    }
    if (values.class_id !== undefined && values.class_id !== null) {
      formData.append('class_id', String(values.class_id))
    }

    const optionalTextFields = [
      'homecity', 'address', 'description', 'hair_color', 'facebook'
    ]
    optionalTextFields.forEach(field => {
      const value = trim(values[field])
      if (value) formData.append(field, value)
    })

    if (attachment) formData.append('attachment', attachment)
    return formData
  }

  const buildEditFormData = values => {
    const formData = new FormData()
    const activeHobbyBits = hobbyOptions.map(item => Number(item.bit_value))
    const current = normalizeValues(values, activeHobbyBits)
    const initial = initialSnapshotRef.current
    let changed = false

    EDITABLE_FIELDS.forEach(field => {
      if (!initial || current[field] === initial[field]) return
      let value = current[field]
      if (field === 'sex') value = value === null ? '' : String(value)
      else if (field === 'class_id') value = value === null ? '' : String(value)
      else if (field === 'dob') value = value || ''
      else value = String(value === null || value === undefined ? '' : value)
      formData.append(field, value)
      changed = true
    })

    if (values.password) {
      formData.append('password', values.password)
      changed = true
    }
    if (attachment) {
      formData.append('attachment', attachment)
      changed = true
    }
    return { formData, changed }
  }

  const applyBackendErrors = errorData => {
    const payload = errorData?.data || errorData || {}
    const source = payload.errors || payload.validation_errors || payload
    const fieldErrors = {}

    if (Array.isArray(source)) {
      source.forEach(item => {
        const name = item?.field || item?.name || item?.key
        if (name) fieldErrors[name] = getErrorText(item)
      })
    } else if (source && typeof source === 'object') {
      FIELD_NAMES.concat('attachment').forEach(name => {
        if (source[name] !== undefined) fieldErrors[name] = getErrorText(source[name])
      })
    }

    const formErrors = FIELD_NAMES
      .filter(name => fieldErrors[name])
      .map(name => ({ name, errors: [fieldErrors[name]] }))

    if (!formErrors.length && typeof payload.message === 'string') {
      const normalizedMessage = payload.message.toLowerCase()
      const inferredField = [
        ['username', ['username', 'tài khoản', 'tên đăng nhập']],
        ['email', ['email']],
        ['code', ['code', 'mã học sinh', 'mã sinh viên']],
        ['class_id', ['class_id', 'lớp']],
        ['hobbies', ['hobbies', 'sở thích']],
        ['password', ['password', 'mật khẩu']],
        ['attachment', ['attachment', 'ảnh']],
      ].find(([, keywords]) => keywords.some(keyword => normalizedMessage.includes(keyword)))?.[0]

      if (inferredField === 'attachment') {
        fieldErrors.attachment = payload.message
      } else if (inferredField) {
        formErrors.push({ name: inferredField, errors: [payload.message] })
      }
    }
    if (formErrors.length) form.setFields(formErrors)
    if (fieldErrors.attachment) setAttachmentError(fieldErrors.attachment)

    const firstField = formErrors[0]?.name
    if (firstField) form.scrollToField(firstField)
    if (!formErrors.length && !fieldErrors.attachment) {
      message.error(payload.message || (isRecordEdit
        ? 'Không thể cập nhật sinh viên'
        : 'Không thể thêm mới sinh viên'))
    }
  }

  const prepareForNextStudent = () => {
    form.setFields([
      { name: 'code', errors: ['Vui lòng đổi mã học sinh cho sinh viên tiếp theo'] },
      { name: 'email', errors: ['Vui lòng đổi email cho sinh viên tiếp theo'] },
      { name: 'username', errors: ['Vui lòng đổi tài khoản cho sinh viên tiếp theo'] },
    ])
    setAttachmentError('')
    setDirty(true)
    setSubmitMode(null)
    window.requestAnimationFrame(() => codeInputRef.current?.focus())
  }

  const handleSubmit = continueAfterCreate => {
    if (submitting) return
    setAttachmentError('')

    form.validateFields()
      .then(values => {
        if (isRecordEdit) {
          const { formData, changed } = buildEditFormData(values)
          if (!changed) {
            message.info('Không có thay đổi để lưu.')
            return
          }
          setSubmitMode('save')
          dispatch(updateStudent(
            numericId,
            formData,
            () => {
              setDirty(false)
              message.success(isCopy
                ? 'Cập nhật bản sao sinh viên thành công'
                : 'Cập nhật sinh viên thành công')
              history.push(postSaveRoute)
            },
            error => {
              setSubmitMode(null)
              applyBackendErrors(error)
            }
          ))
          return
        }

        setSubmitMode(continueAfterCreate ? 'continue' : 'create')
        const formData = buildFormData(values)
        dispatch(createStudent(
          formData,
          () => {
            message.success('Thêm mới sinh viên thành công')
            if (continueAfterCreate) {
              prepareForNextStudent()
            } else {
              setDirty(false)
              history.push('/app/student/list')
            }
          },
          error => {
            setSubmitMode(null)
            applyBackendErrors(error)
          }
        ))
      })
      .catch(error => {
        setSubmitMode(null)
        const firstField = error?.errorFields?.[0]?.name
        if (firstField) form.scrollToField(firstField)
      })
  }

  const leavePage = () => {
    clearAttachment()
    history.push(cancelRoute)
  }

  const handleCancel = () => {
    if (submitting) return
    if (!dirty) {
      leavePage()
      return
    }

    Modal.confirm({
      title: isRecordEdit ? 'Hủy chỉnh sửa sinh viên?' : 'Hủy thêm mới sinh viên?',
      content: 'Các thay đổi chưa được lưu. Bạn có chắc chắn muốn rời khỏi trang?',
      okText: 'Rời trang',
      cancelText: 'Ở lại',
      onOk: leavePage
    })
  }

  const requiredTrimmedRule = (label, max) => ({
    validator: (_, value) => {
      const normalized = trim(value)
      if (!normalized) return Promise.reject(new Error(`Vui lòng nhập ${label}`))
      if (normalized.length > max) {
        return Promise.reject(new Error(`${label} không được vượt quá ${max} ký tự`))
      }
      return Promise.resolve()
    }
  })

  const passwordRules = isRecordEdit ? [
    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
    { max: 256, message: 'Mật khẩu không được vượt quá 256 ký tự' },
    {
      validator: (_, value) => (
        !value || PASSWORD_PATTERN.test(value)
          ? Promise.resolve()
          : Promise.reject(new Error('Mật khẩu cần có chữ hoa, chữ thường, số và ký tự đặc biệt'))
      )
    }
  ] : [
    { required: true, message: 'Vui lòng nhập mật khẩu' },
    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
    { max: 256, message: 'Mật khẩu không được vượt quá 256 ký tự' },
    {
      pattern: PASSWORD_PATTERN,
      message: 'Mật khẩu cần có chữ hoa, chữ thường, số và ký tự đặc biệt'
    }
  ]

  const renderLoadState = () => {
    if (!isRecordEdit) return null
    if (!validId) {
      return (
        <Card>
          <Result
            status="warning"
            title={validRouteId
              ? 'Không có dữ liệu bản sao hợp lệ để hiệu chỉnh.'
              : 'ID sinh viên không hợp lệ.'}
            extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về danh sách Sinh viên</Button>}
          />
        </Card>
      )
    }
    if ((!copiedStudent && detailLoading) || !hobbiesLoaded) {
      return <Card className="student-create-card"><Skeleton active paragraph={{ rows: 12 }} /></Card>
    }
    if (!copiedStudent && detailError) {
      const status = Number(detailError.status)
      const notFound = status === 404
      const forbidden = status === 401 || status === 403
      return (
        <Card>
          <Result
            status={notFound ? '404' : forbidden ? '403' : 'error'}
            title={
              notFound
                ? 'Không tìm thấy sinh viên.'
                : forbidden
                  ? 'Bạn không có quyền chỉnh sửa sinh viên này.'
                  : 'Không thể tải thông tin sinh viên.'
            }
            subTitle={notFound || forbidden ? undefined : detailError.message}
            extra={[
              !notFound && !forbidden && (
                <Button key="retry" type="primary" onClick={() => dispatch(fetchStudentDetail(numericId))}>
                  Thử lại
                </Button>
              ),
              <Button key="back" onClick={() => history.push(listRoute)}>Trở về danh sách Sinh viên</Button>
            ].filter(Boolean)}
          />
        </Card>
      )
    }
    if (!formDetail || Number(formDetail.id) !== numericId) {
      return (
        <Card>
          <Result
            status="404"
            title="Không tìm thấy sinh viên."
            extra={<Button type="primary" onClick={() => history.push(listRoute)}>Trở về danh sách Sinh viên</Button>}
          />
        </Card>
      )
    }
    return null
  }

  const loadState = renderLoadState()
  const displayImageUrl = attachment ? previewUrl : currentAttachmentUrl

  return (
    <>
      <div className="student-create-page">
      <Breadcrumb>
        <Breadcrumb.Item><Link to={listRoute}>Quản lý danh mục</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={listRoute}>Sinh viên</Link></Breadcrumb.Item>
        <Breadcrumb.Item>{isCopy ? 'Sao chép' : isEdit ? 'Chỉnh sửa' : 'Thêm mới'}</Breadcrumb.Item>
      </Breadcrumb>
      <h1 className="student-create-heading">
        {isCopy ? 'Sao chép thành công Sinh viên' : isEdit ? 'Chỉnh sửa Sinh viên' : 'Thêm mới Sinh viên'}
      </h1>
      {isCopy && (
        <p className="text-muted">
          Có thể hiệu chỉnh lại thông tin sinh viên sau khi sao chép
        </p>
      )}

      {loadState || <Card className="student-create-card">
        <Form
          form={form}
          layout="vertical"
          initialValues={isRecordEdit
            ? { hobbies: [] }
            : { hobbies: [], sex: true, hair_color: '#000000' }}
          onValuesChange={(_, allValues) => {
            setDirty(true)
            setHairColor(allValues.hair_color || '')
          }}
        >
          <Row gutter={[28, 0]}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="code"
                label="Mã học sinh"
                rules={[requiredTrimmedRule('mã học sinh', 50)]}
              >
                <Input
                  ref={codeInputRef}
                  disabled={isRecordEdit}
                  suffix={isRecordEdit ? <LockOutlined /> : null}
                  maxLength={50}
                  placeholder="Nhập mã học sinh"
                />
              </Form.Item>

              <Form.Item
                name="fullname"
                label="Họ và tên"
                rules={[requiredTrimmedRule('họ và tên', 30)]}
              >
                <Input maxLength={30} placeholder="Nhập họ và tên đầy đủ" />
              </Form.Item>

              <Form.Item
                name="dob"
                label="Ngày sinh"
                rules={[{
                  validator: (_, value) => (
                    !value || value.endOf('day').isSameOrBefore(moment().endOf('day'))
                      ? Promise.resolve()
                      : Promise.reject(new Error('Ngày sinh không được lớn hơn ngày hiện tại'))
                  )
                }]}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="DD/MM/YYYY"
                  disabledDate={date => date && date > moment().endOf('day')}
                />
              </Form.Item>

              <Form.Item name="sex" label="Giới tính">
                <Radio.Group>
                  <Radio value={true}>Nam</Radio>
                  <Radio value={false}>Nữ</Radio>
                </Radio.Group>
              </Form.Item>

              <div className="student-create-class-row">
              <Form.Item name="class_id" label="Lớp">
                <Select
                  allowClear
                  showSearch
                  loading={loadingClasses}
                  disabled={loadingClasses}
                  placeholder={loadingClasses ? 'Đang tải danh sách lớp...' : 'Chọn lớp'}
                  notFoundContent={loadingClasses ? <Spin size="small" /> : (
                    classLoadError
                      ? <Button type="link" onClick={loadClasses}>Tải lại danh sách lớp</Button>
                      : 'Không có dữ liệu'
                  )}
                  filterOption={(input, option) => (
                    String(option.children).toLowerCase().includes(input.toLowerCase())
                  )}
                >
                  {classes.map(item => (
                    <Option key={item.id} value={item.id}>{getClassOptionLabel(item)}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Tooltip title="Thêm lớp mới">
                <Button
                  className="student-create-class-add"
                  type="primary"
                  ghost
                  icon={<PlusOutlined />}
                  disabled={creatingClass}
                  onClick={() => setClassModalVisible(true)}
                  aria-label="Thêm lớp mới"
                />
              </Tooltip>
              </div>

              <Form.Item
                name="homecity"
                label="Quê quán"
                rules={[{ max: 100, message: 'Quê quán không được vượt quá 100 ký tự' }]}
              >
                <Input maxLength={100} placeholder="Tỉnh/Thành phố" />
              </Form.Item>

              <Form.Item
                name="address"
                label="Địa chỉ"
                rules={[{ max: 100, message: 'Địa chỉ không được vượt quá 100 ký tự' }]}
              >
                <Input maxLength={100} placeholder="Nhập địa chỉ" />
              </Form.Item>

              <div className="student-create-hobby-row">
                <Form.Item name="hobbies" label="Sở thích">
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    maxTagCount="responsive"
                    loading={loadingHobbies}
                    disabled={loadingHobbies}
                    placeholder={loadingHobbies ? 'Đang tải sở thích...' : 'Chọn sở thích'}
                    onChange={values => setSelectedHobbyBits(values)}
                    notFoundContent={loadingHobbies ? <Spin size="small" /> : (
                      hobbyLoadError
                        ? <Button type="link" onClick={loadHobbies}>Tải lại sở thích</Button>
                        : 'Không có dữ liệu'
                    )}
                  >
                    {hobbyOptions.map(item => (
                      <Option key={item.id || item.bit_value} value={Number(item.bit_value)}>
                        {getOptionLabel(item)}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Tooltip title="Thêm sở thích mới">
                  <Button
                    className="student-create-hobby-add"
                    type="primary"
                    ghost
                    icon={<PlusOutlined />}
                    disabled={loadingHobbies}
                    onClick={() => setHobbyModalVisible(true)}
                    aria-label="Thêm sở thích mới"
                  />
                </Tooltip>
              </div>

              <Form.Item name="description" label="Mô tả">
                <TextArea rows={4} placeholder="Nhập mô tả" />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item
                label="Ảnh thẻ"
                validateStatus={attachmentError ? 'error' : undefined}
                help={attachmentError || 'Định dạng JPG, JPEG, PNG; tối đa 5MB'}
              >
                <Upload
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  beforeUpload={handleAttachment}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>
                    {isRecordEdit && currentAttachmentUrl ? 'Chọn ảnh thay thế' : 'Chọn ảnh'}
                  </Button>
                </Upload>
                {displayImageUrl && (
                  <div className="student-create-upload-preview">
                    {previewFailed ? (
                      <div className="student-create-upload-fallback">Không thể xem trước ảnh</div>
                    ) : (
                      <img
                        src={displayImageUrl}
                        alt={attachment ? 'Xem trước ảnh thẻ mới' : 'Ảnh thẻ hiện tại'}
                        onError={() => setPreviewFailed(true)}
                      />
                    )}
                    <div>
                      <div className="student-create-upload-name" title={attachment?.name}>
                        {attachment ? attachment.name : 'Ảnh thẻ hiện tại'}
                      </div>
                      {attachment && <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={removeAttachment}
                      >
                        {isRecordEdit ? 'Hủy ảnh mới' : 'Xóa ảnh'}
                      </Button>}
                    </div>
                  </div>
                )}
              </Form.Item>

              <Form.Item label="Màu tóc">
                <div className="student-create-color-row">
                  <Form.Item
                    name="hair_color"
                    rules={[{
                      validator: (_, value) => (
                        !trim(value) || /^#[0-9A-Fa-f]{6}$/.test(trim(value))
                          ? Promise.resolve()
                          : Promise.reject(new Error('Màu tóc phải đúng định dạng #RRGGBB'))
                      )
                    }]}
                  >
                    <Input
                      maxLength={7}
                      placeholder="#RRGGBB"
                      onBlur={event => {
                        const value = trim(event.target.value).toUpperCase()
                        setHairColor(value)
                        form.setFieldsValue({ hair_color: value })
                      }}
                    />
                  </Form.Item>
                  <ColorPicker placement="bottomRight" color={hairColor || '#000000'} colorChange={handleColorChange} />
                </div>
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, whitespace: true, message: 'Vui lòng nhập email' },
                  { pattern: EMAIL_PATTERN, message: 'Email không đúng định dạng' },
                  { max: 256, message: 'Email không được vượt quá 256 ký tự' }
                ]}
              >
                <Input maxLength={256} placeholder="example@university.edu.vn" />
              </Form.Item>

              <Form.Item
                name="facebook"
                label="Facebook"
                rules={[
                  { max: 256, message: 'Facebook không được vượt quá 256 ký tự' },
                  {
                    validator: (_, value) => (
                      !trim(value) || FACEBOOK_PATTERN.test(trim(value))
                        ? Promise.resolve()
                        : Promise.reject(new Error('Facebook không đúng định dạng'))
                    )
                  }
                ]}
              >
                <Input maxLength={256} placeholder="https://facebook.com/..." />
              </Form.Item>

              <Form.Item
                name="username"
                label="Tài khoản"
                rules={[requiredTrimmedRule('tài khoản', 50)]}
              >
                <Input
                  disabled={isRecordEdit}
                  suffix={isRecordEdit ? <LockOutlined /> : null}
                  maxLength={50}
                  autoComplete="username"
                  placeholder="Tên đăng nhập hệ thống"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={isRecordEdit ? 'Mật khẩu mới' : 'Mật khẩu'}
                rules={passwordRules}
                extra={isRecordEdit ? 'Để trống nếu không muốn đổi mật khẩu.' : undefined}
              >
                <Input.Password
                  maxLength={256}
                  autoComplete="new-password"
                  placeholder={isRecordEdit ? 'Nhập mật khẩu mới (không bắt buộc)' : 'Nhập mật khẩu'}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="student-create-actions">
            <Button disabled={submitting} onClick={handleCancel}>Hủy bỏ</Button>
            {!isRecordEdit && <Button
              disabled={submitting}
              loading={submitting && submitMode === 'continue'}
              onClick={() => handleSubmit(true)}
            >
              Thêm mới và tiếp tục
            </Button>}
            <Button
              type="primary"
              disabled={submitting}
              loading={submitting && submitMode === (isRecordEdit ? 'save' : 'create')}
              onClick={() => handleSubmit(false)}
            >
              {isCopy ? 'Lưu' : isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
          </div>
        </Form>
        </Card>}
      </div>

      <Modal
        visible={hobbyModalVisible}
        title="Thêm sở thích mới"
        okText="Thêm sở thích"
        cancelText="Hủy bỏ"
        confirmLoading={creatingHobby}
        maskClosable={!creatingHobby}
        closable={!creatingHobby}
        onOk={handleCreateHobby}
        onCancel={closeHobbyModal}
        destroyOnClose
      >
        <Form form={hobbyForm} layout="vertical">
          <Form.Item
            name="name"
            label="Tên sở thích"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập tên sở thích' },
              { max: 30, message: 'Tên sở thích không được vượt quá 30 ký tự' }
            ]}
          >
            <Input
              maxLength={30}
              autoFocus
              placeholder="Nhập tên sở thích"
              onPressEnter={handleCreateHobby}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        visible={classModalVisible}
        title="Thêm mới lớp"
        okText="Thêm lớp"
        cancelText="Hủy bỏ"
        confirmLoading={creatingClass}
        maskClosable={!creatingClass}
        closable={!creatingClass}
        keyboard={!creatingClass}
        onOk={handleCreateClass}
        onCancel={closeClassModal}
        destroyOnClose
      >
        <Form form={classForm} layout="vertical">
          <Form.Item name="code" label="Mã lớp" rules={[requiredTrimmedRule('mã lớp', 50)]}>
            <Input maxLength={50} autoFocus placeholder="Nhập mã lớp" onPressEnter={handleCreateClass} />
          </Form.Item>
          <Form.Item name="name" label="Tên lớp" rules={[requiredTrimmedRule('tên lớp', 255)]}>
            <Input maxLength={255} placeholder="Nhập tên lớp" onPressEnter={handleCreateClass} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={4} placeholder="Nhập mô tả lớp (không bắt buộc)" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default StudentForm
