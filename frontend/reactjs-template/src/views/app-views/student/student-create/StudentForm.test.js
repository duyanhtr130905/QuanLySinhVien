import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Route, Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import StudentForm from './StudentForm'
import { saveStudentCreateDraft, STUDENT_CREATE_DRAFT_KEY } from './studentDraftStorage'
import { STUDENT_CREATE } from 'redux/constants/Student'
import ClassService from 'services/ClassService'
import HobbyService from 'services/HobbyService'

jest.mock('services/ClassService', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(() => Promise.resolve([{ id: 12, code: 'C12', name: 'Lớp 12' }])),
  },
}))

jest.mock('services/HobbyService', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(() => Promise.resolve([
      { id: 1, name: 'Thể thao', bit_value: 1 },
      { id: 4, name: 'Đọc sách', bit_value: 4 },
    ])),
  },
}))

jest.mock('components/shared-components/ColorPicker', () => () => null)

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: query => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

const defaultStudent = {
  detail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
}

const renderCreateForm = () => {
  const actions = []
  const store = createStore((state, action) => {
    actions.push(action)
    return state
  }, { student: defaultStudent })
  const history = createMemoryHistory({ initialEntries: ['/app/student/create'] })
  const view = render(
    <Provider store={store}>
      <Router history={history}>
        <Route path="/app/student/:mode/:id?" render={() => <StudentForm mode="create" />} />
      </Router>
    </Provider>
  )
  return { actions, history, ...view }
}

const fillRequiredCreateFields = () => {
  fireEvent.change(screen.getByLabelText('Mã học sinh'), { target: { value: 'SV01' } })
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn A' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } })
  fireEvent.change(screen.getByLabelText('Tài khoản'), { target: { value: 'nguyenvana' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Passw0rd!' } })
}

const waitForLookupOptions = async () => {
  await waitFor(() => {
    expect(screen.getByLabelText('Lớp').disabled).toBe(false)
    expect(screen.getByLabelText('Sở thích').disabled).toBe(false)
  })
}

describe('StudentForm create drafts', () => {
  beforeEach(() => {
    window.localStorage.clear()
    ClassService.getAll.mockResolvedValue([{ id: 12, code: 'C12', name: 'Lớp 12' }])
    HobbyService.getAll.mockResolvedValue([
      { id: 1, name: 'Thể thao', bit_value: 1 },
      { id: 4, name: 'Đọc sách', bit_value: 4 },
    ])
  })

  test('returns a pristine create form directly to the student list', async () => {
    const { history } = renderCreateForm()
    await waitForLookupOptions()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    expect(history.location.pathname).toBe('/app/student/list')
    expect(history.location.pathname).not.toContain('/detail/')
  })

  test('offers save, discard, and continue actions when cancelling a dirty create form', async () => {
    const { history } = renderCreateForm()
    await waitForLookupOptions()
    fireEvent.change(screen.getByLabelText('Mã học sinh'), { target: { value: 'SV01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))

    expect(screen.getByRole('button', { name: 'Lưu bản nháp và thoát' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Không lưu và thoát' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }))
    expect(history.location.pathname).toBe('/app/student/create')
    expect(screen.getByLabelText('Mã học sinh').value).toBe('SV01')
  })

  test('saves a local draft then exits, or discards it before exit', async () => {
    const first = renderCreateForm()
    await waitForLookupOptions()
    fireEvent.change(screen.getByLabelText('Mã học sinh'), { target: { value: 'SV02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản nháp và thoát' }))
    expect(first.history.location.pathname).toBe('/app/student/list')
    expect(window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)).toContain('SV02')
    first.unmount()

    const second = renderCreateForm()
    await waitForLookupOptions()
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    fireEvent.click(screen.getByRole('button', { name: 'Không lưu và thoát' }))
    expect(second.history.location.pathname).toBe('/app/student/list')
    expect(window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)).toBeNull()
  })

  test('restores draft fields only after class and hobby options are available', async () => {
    saveStudentCreateDraft({
      code: 'SV03', fullname: 'Nguyễn Văn C', dob: '2004-01-15', sex: false,
      class_id: 12, hobbies: [4], hair_color: '#123456', username: 'nguyenvanc',
    }, { hasAttachment: true })
    const { actions } = renderCreateForm()

    expect(await screen.findByText('Đã khôi phục bản nháp chưa hoàn thành')).toBeTruthy()
    expect(screen.getByLabelText('Mã học sinh').value).toBe('SV03')
    expect(screen.getByLabelText('Ngày sinh').value).toBe('15/01/2004')
    expect(screen.getByLabelText('Nữ').checked).toBe(true)
    expect(screen.getByText('C12 - Lớp 12')).toBeTruthy()
    expect(screen.getByPlaceholderText('#RRGGBB').value).toBe('#123456')
    expect(screen.getByText('Ảnh không được lưu trong bản nháp. Vui lòng chọn lại ảnh nếu cần.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Passw0rd!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    await waitFor(() => expect(actions.some(action => action.type === STUDENT_CREATE)).toBe(true))
    expect(actions.find(action => action.type === STUDENT_CREATE).formData.get('hobbies')).toBe('4')
  })

  test('clears the draft after a successful create', async () => {
    saveStudentCreateDraft({ code: 'OLD', hobbies: [] })
    const { actions } = renderCreateForm()
    await screen.findByText('Đã khôi phục bản nháp chưa hoàn thành')
    fillRequiredCreateFields()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))

    await waitFor(() => expect(actions.some(action => action.type === STUDENT_CREATE)).toBe(true))
    const action = actions.find(item => item.type === STUDENT_CREATE)
    act(() => action.onSuccess())
    expect(window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)).toBeNull()
  })
})
