import React from 'react'
import { Button, Checkbox } from 'antd'

const ColumnChooser = ({
  columns,
  value,
  requiredKeys,
  onChange,
  onClose,
}) => (
  <div
    className="student-column-chooser"
    onClick={event => event.stopPropagation()}
    style={{ width: 260, padding: 12, background: '#fff' }}
  >
    <Checkbox.Group
      value={value}
      onChange={onChange}
      className="student-column-chooser-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      {columns.map(column => (
        <Checkbox
          key={column.key}
          value={column.key}
          disabled={requiredKeys.includes(column.key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            minHeight: 24,
            margin: '0 0 10px',
            lineHeight: '24px',
          }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 24,
            lineHeight: '24px',
          }}>
            {column.label || column.title}
          </span>
        </Checkbox>
      ))}
    </Checkbox.Group>
    <div className="student-column-chooser-footer">
      <Button type="link" size="small" onClick={onClose}>Đóng</Button>
    </div>
  </div>
)

ColumnChooser.defaultProps = {
  columns: [],
  value: [],
  requiredKeys: [],
}

export default ColumnChooser
