import downloadBlob, { getDownloadFilename } from './downloadBlob'

describe('downloadBlob', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    window.URL.createObjectURL = jest.fn(() => 'blob:class-export')
    window.URL.revokeObjectURL = jest.fn()
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    HTMLAnchorElement.prototype.click.mockRestore()
  })

  test('downloads a blob and revokes its object URL after the download starts', () => {
    downloadBlob(new Blob(['class']), 'classes.csv')
    expect(window.URL.createObjectURL).toHaveBeenCalled()
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled()
    jest.runOnlyPendingTimers()
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:class-export')
  })

  test('uses a sanitized Content-Disposition filename or the fallback', () => {
    expect(getDownloadFilename('attachment; filename="classes.csv"', 'fallback.csv')).toBe('classes.csv')
    expect(getDownloadFilename(undefined, 'fallback.csv')).toBe('fallback.csv')
  })
})
