export const isEditableTarget = target => {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.contentEditable === 'true' || target.getAttribute('contenteditable') === 'true') return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .ant-input, .ant-select, .ant-picker, .ant-input-number'))
}

export const isPrimaryModifier = event => event.ctrlKey || event.metaKey

export const matchesShortcut = (event, shortcut) => {
  const key = String(event.key || '').toLowerCase()
  const expected = String(shortcut.key || '').toLowerCase()
  if (key !== expected) return false
  if (Boolean(shortcut.alt) !== event.altKey) return false
  if (expected !== '?' && Boolean(shortcut.shift) !== event.shiftKey) return false
  if (Boolean(shortcut.primary) !== isPrimaryModifier(event)) return false
  if (!shortcut.primary && (event.ctrlKey || event.metaKey)) return false
  return true
}

export const shortcutLabel = shortcut => {
  const mac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
  const parts = []
  if (shortcut.primary) parts.push(mac ? '⌘' : 'Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')
  parts.push(shortcut.key === 'ArrowLeft' ? '←' : shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase())
  return parts.join(' + ')
}
