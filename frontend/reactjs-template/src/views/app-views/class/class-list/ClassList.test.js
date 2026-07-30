import React from 'react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import ClassList from './ClassList'

jest.mock('components/shared-components/ColumnChooser', () => ({
  __esModule: true,
  default: () => <div />,
}))

jest.mock('components/shared-components/DraggableColumnTitle', () => ({
  __esModule: true,
  default: ({ column }) => <span>{column.title}</span>,
}))

jest.mock('redux/actions/Class', () => ({
  __esModule: true,
  fetchClassList: params => ({ type: 'CLASS_LIST_FETCH', params }),
  deleteClass: () => ({ type: 'CLASS_DELETE' }),
}))

jest.mock('services/ClassService', () => ({
  __esModule: true,
  default: {
    copyOne: () => Promise.resolve(),
    massCopy: () => Promise.resolve(),
    massDestroy: () => Promise.resolve(),
  },
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

const renderList = (classroom = {}, classListState) => {
  const store = createStore(state => state, {
    classroom: {
      list: [],
      pageInfo: { total_items: 0, total_pages: 0, current: 1, size: 10 },
      listLoading: false,
      error: null,
      ...classroom,
    },
  })
  const history = createMemoryHistory({
    initialEntries: [{ pathname: '/app/class/list', state: classListState ? { classListState } : undefined }],
  })
  return render(
    <Provider store={store}>
      <Router history={history}>
        <ClassList />
      </Router>
    </Provider>
  )
}

describe('ClassList', () => {
  test('renders the normalized student count and prevents deletion of an in-use class', () => {
    renderList({
      list: [{ id: 7, code: 'CTK42', name: 'CNTT 42', description: '', student_count: '3' }],
      pageInfo: { total_items: 1, total_pages: 1, current: 1, size: 10 },
    })

    expect(screen.getByText('Số sinh viên')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByLabelText('Xóa lớp CNTT 42').disabled).toBe(true)
  })

  test('disables bulk deletion when a selected class still has students', async () => {
    renderList({
      list: [{ id: 7, code: 'CTK42', name: 'CNTT 42', description: '', student_count: 3 }],
      pageInfo: { total_items: 1, total_pages: 1, current: 1, size: 10 },
    }, {
      selectedRowKeys: [7],
      selectedRecordsById: { 7: { id: 7, student_count: 3 } },
    })

    const actionButton = screen.getAllByText('Hành động').find(element => element.closest('button'))
    await act(async () => {
      fireEvent.click(actionButton)
    })
    await waitFor(() => {
      expect(screen.getByText('Xóa dữ liệu đã chọn').closest('li').className).toContain('disabled')
    })
  })
})
