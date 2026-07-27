import React, { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'

const COLUMN_DRAG_TYPE = 'business-table-column'

const DraggableColumnTitle = ({ column, moveColumn }) => {
  const ref = useRef(null)
  const [{ isDragging }, drag] = useDrag({
    item: { type: COLUMN_DRAG_TYPE, key: column.key },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  })
  const [, drop] = useDrop({
    accept: COLUMN_DRAG_TYPE,
    hover: item => {
      if (item.key === column.key) return
      moveColumn(item.key, column.key)
      item.key = column.key
    },
  })
  drag(drop(ref))

  return (
    <div
      ref={ref}
      className="student-column-drag-handle"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <span>{column.title}</span>
    </div>
  )
}

export default DraggableColumnTitle
