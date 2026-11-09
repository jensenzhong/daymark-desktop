import { useState, type KeyboardEvent } from 'react'
import type { Todo } from '@shared/types'

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onSetReminder: (id: string, reminderAt: number | null) => void
}

function toLocalDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function TodoItem({ todo, onToggle, onEdit, onDelete, onSetReminder }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderError, setReminderError] = useState(false)

  const commit = (): void => {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed && trimmed !== todo.text) onEdit(todo.id, trimmed)
    else setDraft(todo.text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setDraft(todo.text)
      setEditing(false)
    }
  }

  return (
    <li className="group flex flex-col gap-1 px-3 py-1.5 rounded-lg hover:bg-white/5">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          className="checkbox w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
          aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-sm min-w-0"
            style={{ color: 'var(--color-text)' }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className="flex-1 text-sm leading-relaxed cursor-text min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]"
            style={{
              color: todo.done ? 'var(--color-text-muted)' : 'var(--color-text)',
              textDecoration: todo.done ? 'line-through' : 'none'
            }}
          >
            {todo.text}
          </span>
        )}
        <button
          onClick={() => {
            setReminderError(false)
            setReminderOpen((open) => !open)
          }}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0 leading-none"
          style={{ color: todo.reminderAt ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          aria-label={todo.reminderAt ? 'Change reminder' : 'Set reminder'}
          title={todo.reminderAt ? 'Change reminder' : 'Set reminder'}
        >
          ◷
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0 leading-none"
          aria-label="Delete todo"
        >
          ×
        </button>
      </div>

      {reminderOpen && (
        <div className="ml-6 flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Remind me at
            <input
              type="datetime-local"
              min={toLocalDateTimeInput(Date.now() + 60_000)}
              value={todo.reminderAt ? toLocalDateTimeInput(todo.reminderAt) : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  onSetReminder(todo.id, null)
                  setReminderError(false)
                  return
                }
                const reminderAt = new Date(e.target.value).getTime()
                if (!Number.isFinite(reminderAt) || reminderAt <= Date.now()) {
                  setReminderError(true)
                  return
                }
                setReminderError(false)
                onSetReminder(todo.id, reminderAt)
              }}
              className="block w-full mt-1 rounded-md px-2 py-1 text-xs"
              style={{
                color: 'var(--color-text)',
                colorScheme: 'dark',
                background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-text) 14%, transparent)'
              }}
              aria-label="Reminder date and time"
            />
          </label>
          {reminderError && <span className="text-xs text-red-400">Choose a future time.</span>}
        </div>
      )}

      {todo.reminderAt && !reminderOpen && (
        <div className="ml-6 flex items-center gap-2 text-xs" style={{ color: 'var(--color-accent)' }}>
          <span>
            Reminder · {new Date(todo.reminderAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => onSetReminder(todo.id, null)}
            className="rounded px-1 hover:bg-white/10"
            aria-label="Remove reminder"
            title="Remove reminder"
          >
            ×
          </button>
        </div>
      )}
    </li>
  )
}
