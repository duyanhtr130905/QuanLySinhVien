import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import StudentDeletedList from './StudentDeletedList'
import ClassService from 'services/ClassService'
import StudentService from 'services/StudentService'

jest.mock('services/ClassService', () => ({
  __esModule: true,
  default: { getAll: jest.fn() },
}))

jest.mock('services/StudentService', () => ({
  __esModule: true,
  default: {
    getDeletedByPage: jest.fn(),
    restoreDeleted: jest.fn(),
    permanentlyDelete: jest.fn(),
  },
}))

jest.mock('antd', () => {
  const antd = jest.requireActual('antd')
  return {
    ...antd,
    Modal: { ...antd.Modal, confirm: config => config.onOk() },
  }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: query => ({
    matches: false, media: query, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
  }),
})

const records = [
  { id: '1', code: 'SV01', fullname: 'A', email: 'a@example.com', username: 'a', deleted_at: '2026-01-01T00:00:00Z' },
  { id: '2', code: 'SV02', fullname: 'B', email: 'b@example.com', username: 'b', deleted_at: '2026-01-02T00:00:00Z' },
]

const renderList = () => render(
  <Router history={createMemoryHistory({ initialEntries: ['/app/student/deleted'] })}>
    <StudentDeletedList />
  </Router>
)

describe('StudentDeletedList string row keys', () => {
  beforeEach(() => {
    ClassService.getAll.mockResolvedValue({ data: [] })
    StudentService.getDeletedByPage.mockResolvedValue({
      data: { page_info: { total_items: 2, total_pages: 1, current: 1, size: 10 }, records },
    })
    StudentService.restoreDeleted.mockResolvedValue({ data: { restored: ['1'], notFound: [], conflicts: [] } })
    StudentService.permanentlyDelete.mockResolvedValue({ data: { deleted: ['1'], notFound: [] } })
  })

  test('keeps string-ID rows visible and checked for single and select-all selection', async () => {
    renderList()
    expect(await screen.findByText('SV01')).toBeTruthy()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])

    await waitFor(() => expect(checkboxes[1].checked).toBe(true))
    expect(screen.getByText('SV01')).toBeTruthy()
    expect(screen.getByText('Đã chọn: 1 sinh viên')).toBeTruthy()

    fireEvent.click(checkboxes[0])
    await waitFor(() => expect(checkboxes.slice(1).every(checkbox => checkbox.checked)).toBe(true))
    expect(screen.getByText('SV01')).toBeTruthy()
    expect(screen.getByText('SV02')).toBeTruthy()
    expect(screen.queryByText('No Data')).toBeNull()

    fireEvent.click(checkboxes[1])
    await waitFor(() => expect(screen.getByText('Đã chọn: 1 sinh viên')).toBeTruthy())
    expect(screen.getByText('SV01')).toBeTruthy()
  })

  test('converts canonical row keys back to numeric IDs for restore and permanent delete', async () => {
    renderList()
    expect(await screen.findByText('SV01')).toBeTruthy()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByRole('button', { name: /Hành động/i }))
    fireEvent.click(await screen.findByText('Khôi phục dữ liệu đã chọn'))
    await waitFor(() => expect(StudentService.restoreDeleted).toHaveBeenCalledWith([1]))

    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByRole('button', { name: /Hành động/i }))
    fireEvent.click(await screen.findByText('Xóa vĩnh viễn dữ liệu đã chọn'))
    await waitFor(() => expect(StudentService.permanentlyDelete).toHaveBeenCalledWith([1]))
  })
})
