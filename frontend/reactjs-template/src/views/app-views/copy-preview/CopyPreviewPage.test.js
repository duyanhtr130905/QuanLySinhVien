import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import CopyPreviewPage from './CopyPreviewPage'

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

const renderPreview = service => {
  const history = createMemoryHistory({
    initialEntries: [{ pathname: '/app/class/copy-preview', state: { preview } }],
  })
  render(
    <Router history={history}>
      <CopyPreviewPage entity="class" service={service} />
    </Router>
  )
}

test('edits a class draft locally and only commits on Save all', async () => {
  const service = { commitCopyDrafts: jest.fn().mockResolvedValue({ data: { created: [{ draftKey: 'class-4', record: { id: 9 } }] } }) }
  renderPreview(service)

  fireEvent.click(screen.getByText('Chỉnh sửa'))
  const code = await screen.findByLabelText('Mã lớp')
  fireEvent.change(code, { target: { value: 'C04-final' } })
  fireEvent.click(screen.getByText('Áp dụng vào draft'))

  await waitFor(() => expect(screen.getByText('C04-final')).toBeTruthy())
  expect(service.commitCopyDrafts).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Lưu tất cả (1)'))
  await waitFor(() => expect(service.commitCopyDrafts).toHaveBeenCalledWith([
    expect.objectContaining({ values: expect.objectContaining({ code: 'C04-final' }) }),
  ]))
  expect(await screen.findByText('Đã lưu 1 bản sao lớp')).toBeTruthy()
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
