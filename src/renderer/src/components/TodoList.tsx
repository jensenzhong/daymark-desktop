import { useState } from 'react'
import type { Todo } from '@shared/types'
import { TodoItem } from './TodoItem'
import { useLanguage } from '../lib/language'

interface TodoListProps {
  todos: Todo[]
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onSetReminder: (id: string, reminderAt: number | null) => void
  onReorder: (ids: string[]) => void
}

export function TodoList({ todos, onToggle, onEdit, onDelete, onSetReminder, onReorder }: TodoListProps) {
  const { t } = useLanguage()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

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

  const dropOn = (targetId: string): void => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }

    const reordered = [...sorted]
    const sourceIndex = reordered.findIndex((todo) => todo.id === draggingId)
    const targetIndex = reordered.findIndex((todo) => todo.id === targetId)
    if (sourceIndex >= 0 && targetIndex >= 0) {
      const [moved] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      onReorder(reordered.map((todo) => todo.id))
    }
    setDraggingId(null)
    setDragOverId(null)
  }

  return (
    <ul className="todo-scroll no-drag flex-1 overflow-y-auto px-2 py-1">
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
            setDragOverId(null)
          }}
          onDragOver={setDragOverId}
          onDrop={dropOn}
          isDropTarget={dragOverId === todo.id && draggingId !== todo.id}
        />
      ))}
    </ul>
  )
}
