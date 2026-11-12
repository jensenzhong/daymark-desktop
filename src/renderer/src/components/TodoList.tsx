import { useState } from 'react'
import type { Todo } from '@shared/types'
import { TodoItem } from './TodoItem'
import { useLanguage } from '../lib/language'

interface TodoListProps {
  todos: Todo[]
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onSetReminder: (id: string, reminderAt: number | null) => Promise<void>
  onReorder: (ids: string[]) => void
}

export function TodoList({ todos, onToggle, onEdit, onDelete, onSetReminder, onReorder }: TodoListProps) {
  const { t } = useLanguage()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null)

  if (todos.length === 0) {
    return (
      <div
        className="todo-content-empty flex-1 flex items-center justify-center px-6 text-center text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {t('Nothing here yet. Add your first todo below.', '这里还没有待办，在下方添加一条吧。')}
      </div>
    )
  }

  const sorted = [...todos].sort((a, b) => a.order - b.order)

  const dropOn = (targetId: string, position: 'before' | 'after'): void => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setDropTarget(null)
      return
    }

    const reordered = [...sorted]
    const sourceIndex = reordered.findIndex((todo) => todo.id === draggingId)
    const targetIndex = reordered.findIndex((todo) => todo.id === targetId)
    if (sourceIndex >= 0 && targetIndex >= 0) {
      const [moved] = reordered.splice(sourceIndex, 1)
      const insertionIndex = reordered.findIndex((todo) => todo.id === targetId) + (position === 'after' ? 1 : 0)
      reordered.splice(insertionIndex, 0, moved)
      if (reordered.some((todo, index) => todo.id !== sorted[index].id)) {
        onReorder(reordered.map((todo) => todo.id))
      }
    }
    setDraggingId(null)
    setDropTarget(null)
  }

  return (
    <ul className="todo-scroll no-drag flex-1 overflow-y-auto px-2 py-1" onDragLeave={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null)
    }}>
      {sorted.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetReminder={onSetReminder}
          onDragStart={setDraggingId}
          onDragEnd={() => {
            setDraggingId(null)
            setDropTarget(null)
          }}
          onDragOver={(id, position) => setDropTarget({ id, position })}
          onDrop={dropOn}
          dropPosition={draggingId && dropTarget?.id === todo.id ? dropTarget.position : null}
        />
      ))}
    </ul>
  )
}
