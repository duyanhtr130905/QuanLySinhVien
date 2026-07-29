import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import CopyPreviewPage from './CopyPreviewPage'

jest.mock('services/ClassService', () => ({
  __esModule: true,
  default: { getAll: jest.fn(() => Promise.resolve({ data: [] })) },
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

const preview = {
  drafts: [{
    draftKey: 'class-4', sourceId: 4,
    values: { code: 'C04-copy', name: 'Lớp gốc', description: 'Mô tả' },
  }],
  notFoundIds: [],
}

const renderPreview = (service, entity = 'class', nextPreview = preview) => {
  const history = createMemoryHistory({
    initialEntries: [{ pathname: `/app/${entity}/copy-preview`, state: { preview: nextPreview } }],
  })
  render(
    <Router history={history}>
      <CopyPreviewPage entity={entity} service={service} />
    </Router>
  )
  return history
}

test('edits a class draft locally and only commits on Save', async () => {
  const service = { commitCopyDrafts: jest.fn().mockResolvedValue({ data: { created: [{ draftKey: 'class-4', record: { id: 9 } }] } }) }
  const history = renderPreview(service)

  fireEvent.click(screen.getByText('Chỉnh sửa'))
  const code = await screen.findByLabelText('Mã lớp')
  fireEvent.change(code, { target: { value: 'C04-final' } })
  fireEvent.click(screen.getByText('Áp dụng vào draft'))

  await waitFor(() => expect(screen.getAllByText('C04-final')).toHaveLength(2))
  expect(service.commitCopyDrafts).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Lưu bản sao'))
  await waitFor(() => expect(service.commitCopyDrafts).toHaveBeenCalledWith([
    expect.objectContaining({ values: expect.objectContaining({ code: 'C04-final' }) }),
  ]))
  expect(history.location.pathname).toBe('/app/class/list')
})

test('renders student drafts in a paginated table and saves every draft', async () => {
  const studentPreview = {
    drafts: Array.from({ length: 25 }, (_, index) => ({
      draftKey: `student-${index + 1}`,
      sourceId: index + 1,
      values: {
        code: `SV${String(index + 1).padStart(2, '0')}`,
        fullname: `Sinh viên ${index + 1}`,
        dob: '2002-03-07', sex: true, email: `sv${index + 1}@example.com`,
        username: `student${index + 1}`, class_id: 1,
      },
    })),
    notFoundIds: [],
  }
  const service = { commitCopyDrafts: jest.fn().mockResolvedValue({ data: { created: [] } }) }
  renderPreview(service, 'student', studentPreview)

  expect(screen.getByText('Mã sinh viên')).toBeTruthy()
  expect(screen.getByText('SV01')).toBeTruthy()
  expect(screen.queryByText('SV25')).toBeNull()
  expect(screen.getAllByText('07/03/2002')).toHaveLength(10)
  expect(screen.queryByText('student-1')).toBeNull()

  fireEvent.click(screen.getByTitle('2'))
  expect(await screen.findByText('SV11')).toBeTruthy()
  expect(screen.queryByText('SV01')).toBeNull()

  fireEvent.change(screen.getByPlaceholderText('Tìm kiếm bản sao Sinh viên...'), { target: { value: 'SV25' } })
  expect(await screen.findByText('SV25')).toBeTruthy()
  fireEvent.click(screen.getByText('Lưu tất cả bản sao (25)'))
  await waitFor(() => expect(service.commitCopyDrafts).toHaveBeenCalledWith(studentPreview.drafts))
})

test('shows an informative empty state when preview route state is missing', () => {
  const history = createMemoryHistory({ initialEntries: ['/app/class/copy-preview'] })
  render(
    <Router history={history}>
      <CopyPreviewPage entity="class" service={{ commitCopyDrafts: jest.fn() }} />
    </Router>
  )
  expect(screen.getByText('Không còn dữ liệu xem trước')).toBeTruthy()
})
