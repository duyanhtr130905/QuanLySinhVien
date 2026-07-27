import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { AppViews } from './index'

jest.mock('./student', () => ({
  __esModule: true,
  default: () => <div>STUDENT_MANAGEMENT_PAGE</div>,
}))

jest.mock('./class', () => ({
  __esModule: true,
  default: () => <div>CLASS_MANAGEMENT_PAGE</div>,
}))

describe('catalog route transitions', () => {
  test('switches Student → Class → Student without rendering a blank page', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/app/student/list'],
    })
    render(
      <Router history={history}>
        <AppViews />
      </Router>
    )

    expect(await screen.findByText('STUDENT_MANAGEMENT_PAGE')).toBeTruthy()

    act(() => history.push('/app/class/list'))
    expect(await screen.findByText('CLASS_MANAGEMENT_PAGE')).toBeTruthy()

    act(() => history.push('/app/student/list'))
    expect(await screen.findByText('STUDENT_MANAGEMENT_PAGE')).toBeTruthy()
  })
})
