import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Table } from 'antd'
import { useHistory } from 'react-router-dom'
import { isEditableTarget, matchesShortcut, shortcutLabel } from 'utils/shortcuts'

const ShortcutContext = createContext(null)
const PRIORITY = { global: 100, page: 200, form: 300, modal: 400 }
const allowInEditable = shortcut => Boolean(shortcut.primary && (shortcut.key === 's' || shortcut.key === 'enter'))

const ShortcutHelp = ({ visible, onClose, shortcuts }) => {
  const rows = shortcuts.filter(item => item.description).map((item, index) => ({ key: typeof item.id === 'symbol' ? `shortcut-${index}` : String(item.id || index), group: item.group || 'Khác', keys: shortcutLabel(item), description: item.description }))
  return <Modal visible={visible} title="Phím tắt" footer={null} onCancel={onClose} destroyOnClose>
    <Table size="small" pagination={false} dataSource={rows} columns={[{ title: 'Nhóm', dataIndex: 'group', width: 150 }, { title: 'Phím', dataIndex: 'keys', width: 150 }, { title: 'Thao tác', dataIndex: 'description' }]} />
  </Modal>
}

export const ShortcutProvider = ({ children }) => {
  const history = useHistory()
  const entries = useRef(new Map())
  const [version, setVersion] = useState(0)
  const [helpVisible, setHelpVisible] = useState(false)
  const register = useCallback((entry) => {
    const id = Symbol(entry.description || entry.key)
    entries.current.set(id, { ...entry, id })
    setVersion(value => value + 1)
    return () => { entries.current.delete(id); setVersion(value => value + 1) }
  }, [])
  const globals = useMemo(() => [
    { id: 'help', scope: 'global', key: '?', group: 'Điều hướng', description: 'Mở hướng dẫn phím tắt', handler: () => setHelpVisible(true) },
    { id: 'students', scope: 'global', alt: true, key: '1', group: 'Điều hướng', description: 'Đến danh sách Sinh viên', handler: () => history.push('/app/student/list') },
    { id: 'classes', scope: 'global', alt: true, key: '2', group: 'Điều hướng', description: 'Đến danh sách Lớp', handler: () => history.push('/app/class/list') },
    { id: 'back', scope: 'global', alt: true, key: 'ArrowLeft', group: 'Điều hướng', description: 'Quay lại', handler: () => history.goBack() },
  ], [history])
  useEffect(() => {
    const onKeyDown = event => {
      if (event.isComposing || (event.repeat && event.key === 'Delete')) return
      const candidates = [...entries.current.values(), ...globals]
        .filter(item => item.enabled !== false && matchesShortcut(event, item))
        .filter(item => !isEditableTarget(event.target) || allowInEditable(item))
        .sort((left, right) => (PRIORITY[right.scope || 'page'] || 0) - (PRIORITY[left.scope || 'page'] || 0))
      const shortcut = candidates[0]
      if (!shortcut) return
      event.preventDefault()
      shortcut.handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [globals])
  const activeShortcuts = useMemo(() => [...globals, ...entries.current.values()], [globals, version])
  const contextValue = useMemo(() => ({ register }), [register])
  return <ShortcutContext.Provider value={contextValue}>
    {children}
    <ShortcutHelp visible={helpVisible} onClose={() => setHelpVisible(false)} shortcuts={activeShortcuts} />
  </ShortcutContext.Provider>
}

export const useShortcut = entry => {
  const context = useContext(ShortcutContext)
  const current = useRef(entry)
  current.current = entry
  useEffect(() => context?.register({ ...entry, handler: event => current.current.handler(event) }), [context, entry.key, entry.alt, entry.shift, entry.primary, entry.scope, entry.enabled, entry.description])
}
