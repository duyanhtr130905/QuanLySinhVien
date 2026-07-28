import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router, Route } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import ClassForm from './ClassForm'
import { CLASS_CREATE, CLASS_DETAIL_FETCH, CLASS_UPDATE } from 'redux/constants/Class'

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

const defaultClassroom = {
  detail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
}

const renderForm = ({ path, mode, classroom = {}, getUserConfirmation }) => {
  const actions = []
  const store = createStore((state, action) => {
    actions.push(action)
    return state
  }, { classroom: { ...defaultClassroom, ...classroom } })
  const history = createMemoryHistory({ initialEntries: [path], getUserConfirmation })
  render(
    <Provider store={store}>
      <Router history={history}>
        <Route path="/app/class/:mode/:id?" render={() => <ClassForm mode={mode} />} />
      </Router>
    </Provider>
  )
  return { actions, history }
}

describe('ClassForm', () => {
  test('validates required create fields and submits trimmed JSON only after validation', async () => {
    const { actions } = renderForm({ path: '/app/class/create', mode: 'create' })

    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    expect(await screen.findByText('Vui lòng nhập mã lớp')).toBeTruthy()
    expect(screen.getByText('Vui lòng nhập tên lớp')).toBeTruthy()
    expect(actions.some(action => action.type === CLASS_CREATE)).toBe(false)

    fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: ' C01 ' } })
    fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: ' Lớp 1 ' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: ' Dòng 1\nDòng 2 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))

    await waitFor(() => expect(actions.find(action => action.type === CLASS_CREATE)).toMatchObject({
      data: { code: 'C01', name: 'Lớp 1', description: 'Dòng 1\nDòng 2' },
    }))
  })

  test('create-and-continue resets the form after a successful create', async () => {
    const { actions } = renderForm({ path: '/app/class/create', mode: 'create' })
    fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: 'C02' } })
    fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: 'Lớp 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới và tiếp tục' }))

    await waitFor(() => expect(actions.some(item => item.type === CLASS_CREATE)).toBe(true))
    const action = actions.find(item => item.type === CLASS_CREATE)
    act(() => action.onSuccess())
    expect(screen.getByLabelText('Mã lớp').value).toBe('')
    expect(screen.getByLabelText('Tên lớp').value).toBe('')
  })

  test('loads an edit record, locks code, and only dispatches changed mutable fields', async () => {
    const record = { id: 7, code: 'C07', name: 'Lớp cũ', description: 'Mô tả', student_count: '2' }
    const { actions } = renderForm({
      path: '/app/class/edit/7',
      mode: 'edit',
      classroom: { detail: record },
    })

    await waitFor(() => expect(screen.getByLabelText('Mã lớp').value).toBe('C07'))
    expect(actions.some(action => action.type === CLASS_DETAIL_FETCH && action.id === 7)).toBe(true)
    expect(screen.getByLabelText('Mã lớp').disabled).toBe(true)
    expect(screen.getByLabelText('Số sinh viên').value).toBe('2')

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(actions.some(action => action.type === CLASS_UPDATE)).toBe(false)

    fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: 'Lớp mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(actions.find(action => action.type === CLASS_UPDATE)).toMatchObject({
      id: 7,
      data: { name: 'Lớp mới' },
    }))
  })

  test('shows a not-found state for a missing edit record', () => {
    renderForm({
      path: '/app/class/edit/99',
      mode: 'edit',
      classroom: { detailError: { status: 404, message: 'Không tìm thấy bản ghi lớp học' } },
    })
    expect(screen.getByText('Không tìm thấy bản ghi lớp học')).toBeTruthy()
  })

  test('blocks route changes after the form becomes dirty', () => {
    const getUserConfirmation = (message, callback) => callback(false)
    const { history } = renderForm({
      path: '/app/class/create',
      mode: 'create',
      getUserConfirmation,
    })
    fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: 'C03' } })
    act(() => history.push('/app/class/list'))
    expect(history.location.pathname).toBe('/app/class/create')
  })
})
