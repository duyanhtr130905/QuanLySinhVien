import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Route, Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import ClassDetail from './ClassDetail'
import classReducer from 'redux/reducers/Class'
import {
  CLASS_AVAILABLE_STUDENTS_CLEAR, CLASS_AVAILABLE_STUDENTS_FETCH,
  CLASS_AVAILABLE_STUDENTS_FETCH_FAIL, CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS,
 CLASS_AVAILABLE_STUDENTS_SELECTION_SET, CLASS_DETAIL_FETCH, CLASS_STUDENTS_ADD,
 CLASS_STUDENTS_FETCH, CLASS_STUDENTS_FETCH_SUCCESS, CLASS_STUDENTS_REMOVE_MANY,
} from 'redux/constants/Class'

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

const classroomState = {
  detail: { id: 7, code: 'C07', name: 'Lớp 7', student_count: '1', description: null },
  detailLoading: false,
  detailError: null,
  classStudents: [{ id: 3, code: 'SV03', fullname: 'An', sex: false }],
  classStudentsPageInfo: { total_items: 1, total_pages: 1, current: 1, size: 10 },
  classStudentsLoading: false,
  classStudentsError: null,
  availableStudents: [],
  availableStudentsPageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
  availableStudentsLoading: false,
  availableStudentsError: null,
  selectedAvailableStudentIds: [],
  selectedAvailableStudentsById: {},
  addStudentsLoading: false,
  removingStudentId: null,
}

const selectionActionTypes = new Set([
  CLASS_AVAILABLE_STUDENTS_CLEAR,
  CLASS_AVAILABLE_STUDENTS_FETCH_FAIL,
 CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS,
 CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
 CLASS_STUDENTS_FETCH_SUCCESS,
])

const renderInteractiveDetail = (classroom = classroomState) => {
  const actions = []
  const store = createStore((state, action) => {
    actions.push(action)
    return selectionActionTypes.has(action.type)
      ? { classroom: classReducer(state.classroom, action) }
      : state
  }, { classroom: { ...classReducer(undefined, {}), ...classroom } })
  const history = createMemoryHistory({ initialEntries: ['/app/class/detail/7'] })
  render(
    <Provider store={store}>
      <Router history={history}>
        <Route path="/app/class/detail/:id" component={ClassDetail} />
      </Router>
    </Provider>
  )
  return { actions, history, store }
}

const renderDetail = (path, classroom = classroomState) => {
  const actions = []
  const store = createStore((state, action) => {
    actions.push(action)
    return state
  }, { classroom })
  const history = createMemoryHistory({ initialEntries: [path] })
  render(
    <Provider store={store}>
      <Router history={history}>
        <Route path="/app/class/detail/:id" component={ClassDetail} />
      </Router>
    </Provider>
  )
  return { actions, history }
}

describe('ClassDetail', () => {
  test('shows a recoverable state for an invalid class id', () => {
    renderDetail('/app/class/detail/nope')
    expect(screen.getByText('ID lớp không hợp lệ')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trở về Danh sách Lớp' })).toBeTruthy()
  })

  test('loads class detail and its student list with the route class id', async () => {
    const { actions } = renderDetail('/app/class/detail/7')
    expect(screen.getByText('Lớp 7')).toBeTruthy()
    await waitFor(() => expect(actions.some(action => action.type === CLASS_DETAIL_FETCH && action.id === 7)).toBe(true))
    expect(actions.some(action => action.type === CLASS_STUDENTS_FETCH && action.id === 7)).toBe(true)
    expect(screen.getByText('An')).toBeTruthy()
    expect(screen.queryByText('password')).toBeNull()
  })

 test('opens the independent available-students modal for the current class', async () => {
    const { actions } = renderDetail('/app/class/detail/7')
    fireEvent.click(screen.getByRole('button', { name: /Thêm sinh viên/ }))
    expect(await screen.findByText('Thêm sinh viên vào lớp')).toBeTruthy()
    await waitFor(() => expect(actions.some(action => (
      action.type === CLASS_AVAILABLE_STUDENTS_FETCH && action.id === 7
    ))).toBe(true))
  })

  test('keeps normalized selected class-student keys and submits one batch removal', async () => {
   const { actions, store } = renderInteractiveDetail()
   const checkboxes = await screen.findAllByRole('checkbox')

   fireEvent.click(checkboxes[1])

   expect(await screen.findByText('Đã chọn 1 sinh viên')).toBeTruthy()
   expect(screen.getByRole('button', { name: 'Loại khỏi lớp' }).disabled).toBe(false)

   act(() => {
    store.dispatch({
     type: CLASS_STUDENTS_FETCH_SUCCESS,
     data: {
      records: [{ id: '3', code: 'SV03', fullname: 'An', sex: false }],
      page_info: { total_items: 1, total_pages: 1, current: 1, size: 10 },
     },
    })
   })

   expect((await screen.findAllByRole('checkbox'))[1].checked).toBe(true)

   fireEvent.click(screen.getByRole('button', { name: 'Loại khỏi lớp' }))
   const dialog = await screen.findByRole('dialog')

   expect(within(dialog).getByText(/SV03 - An/)).toBeTruthy()
   fireEvent.click(within(dialog).getByRole('button', { name: 'Loại khỏi lớp' }))

   const batchActions = actions.filter((action) => action.type === CLASS_STUDENTS_REMOVE_MANY)
   expect(batchActions).toHaveLength(1)
   expect(batchActions[0].studentIds).toEqual([3])
   fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }))
  })

  test('uses string row keys so a selected numeric API ID stays checked and renders once', async () => {
    const { store } = renderInteractiveDetail()
    fireEvent.click(screen.getByRole('button', { name: /Thêm sinh viên/ }))
    const dialog = await screen.findByRole('dialog')
    act(() => {
      store.dispatch({
        type: CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS,
        data: {
          records: [{ id: 1, code: 'SV01', fullname: 'An' }, { id: '2', code: 'SV02', fullname: 'Binh' }],
          page_info: { total_items: 2, total_pages: 1, current: 1, size: 10 },
        },
      })
    })

    const checkboxes = await within(dialog).findAllByRole('checkbox')
    fireEvent.click(checkboxes[1])

    await waitFor(() => expect(store.getState().classroom.selectedAvailableStudentIds).toEqual(['1']))
    expect(within(dialog).getAllByText('An')).toHaveLength(1)
    expect(within(dialog).getAllByRole('checkbox')[1].checked).toBe(true)
  })

  test('keeps pinned string-ID selection across pages and submits numeric IDs', async () => {
    const { actions, store } = renderInteractiveDetail()
    fireEvent.click(screen.getByRole('button', { name: /Thêm sinh viên/ }))
    const dialog = await screen.findByRole('dialog')
    act(() => {
      store.dispatch({
        type: CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
        ids: ['1', '2'],
        recordsById: { 1: { id: 1, fullname: 'An' }, 2: { id: '2', fullname: 'Binh' } },
      })
    })
    act(() => {
      store.dispatch({
        type: CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS,
        data: {
          records: [{ id: '3', fullname: 'Cuong' }],
          page_info: { total_items: 3, total_pages: 2, current: 2, size: 10 },
        },
      })
    })

    expect((await within(dialog).findAllByText('An'))).toHaveLength(1)
    expect(within(dialog).getByText('Cuong')).toBeTruthy()
    expect(new Set(within(dialog).getAllByText(/An|Binh|Cuong/).map(element => element.textContent)).size).toBe(3)
    expect(store.getState().classroom.selectedAvailableStudentIds).toEqual(['1', '2'])

    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào lớp' }))
    const addAction = actions.find(action => action.type === CLASS_STUDENTS_ADD)
    expect(addAction.studentIds).toEqual([1, 2])

    act(() => addAction.onSuccess({ studentIds: [1, 2] }))
    await waitFor(() => expect(store.getState().classroom.selectedAvailableStudentIds).toEqual([]))
    expect(store.getState().classroom.selectedAvailableStudentsById).toEqual({})
  })

  test('keeps selection after an available-student API error and clears a deselected pinned record', async () => {
    const { store } = renderInteractiveDetail()
    fireEvent.click(screen.getByRole('button', { name: /Thêm sinh viên/ }))
    const dialog = await screen.findByRole('dialog')
    act(() => {
      store.dispatch({
        type: CLASS_AVAILABLE_STUDENTS_SELECTION_SET,
        ids: ['2'],
        recordsById: { 2: { id: '2', fullname: 'Binh' } },
      })
    })
    act(() => { store.dispatch({ type: CLASS_AVAILABLE_STUDENTS_FETCH_FAIL, message: 'Lỗi tải dữ liệu' }) })
    expect(store.getState().classroom.selectedAvailableStudentIds).toEqual(['2'])

    act(() => {
      store.dispatch({
        type: CLASS_AVAILABLE_STUDENTS_FETCH_SUCCESS,
        data: { records: [{ id: '3', fullname: 'Cuong' }], page_info: { current: 2, size: 10 } },
      })
    })
    const checkedPinnedRow = (await within(dialog).findAllByRole('checkbox')).find(checkbox => checkbox.checked)
    fireEvent.click(checkedPinnedRow)
    await waitFor(() => expect(store.getState().classroom.selectedAvailableStudentIds).toEqual([]))
    expect(store.getState().classroom.selectedAvailableStudentsById).toEqual({})
  })
})
