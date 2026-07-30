import { isEditableTarget, matchesShortcut } from './shortcuts'

const keyEvent = values => ({ key: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...values })

test('matches Ctrl and Command primary modifiers', () => {
  expect(matchesShortcut(keyEvent({ key: 's', ctrlKey: true }), { primary: true, key: 's' })).toBe(true)
  expect(matchesShortcut(keyEvent({ key: 's', metaKey: true }), { primary: true, key: 's' })).toBe(true)
})

test('recognizes editable and contenteditable controls', () => {
  const input = document.createElement('input')
  const editable = document.createElement('div')
  editable.contentEditable = 'true'
  expect(isEditableTarget(input)).toBe(true)
  expect(isEditableTarget(editable)).toBe(true)
  expect(isEditableTarget(document.createElement('button'))).toBe(false)
})
