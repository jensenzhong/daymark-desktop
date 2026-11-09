import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Todo } from '@shared/types'

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onSetReminder: (id: string, reminderAt: number | null) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOver: (id: string) => void
  onDrop: (id: string) => void
  isDropTarget: boolean
}

function toLocalDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function TodoItem({
  todo,
  onToggle,
  onEdit,
  onDelete,
  onSetReminder,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDropTarget
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderError, setReminderError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMenuMounted(false), 140)
    return () => window.clearTimeout(timer)
  }, [menuOpen])

  useLayoutEffect(() => {
    if (!menuMounted || !menuOpen || !menuButtonRef.current || !menuRef.current) return
    const anchor = menuButtonRef.current.getBoundingClientRect()
    const menu = menuRef.current.getBoundingClientRect()
    const margin = 8
    const right = anchor.right + 6
    const left = right + menu.width <= window.innerWidth - margin
      ? right : Math.max(margin, anchor.right - menu.width)
    const top = Math.max(margin, Math.min(anchor.bottom + 4, window.innerHeight - menu.height - margin))
    setMenuPosition({ left, top })
    menuRef.current.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }, [menuMounted, menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuOpen(false)
    }
    const handleKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    const handleFocus = (event: FocusEvent): void => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuOpen(false)
    }
    const close = (): void => setMenuOpen(false)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', handleKey)
    document.addEventListener('focusin', handleFocus)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menuOpen])

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
    <li
      className={`group flex flex-col gap-1 pl-3 pr-1 py-1.5 rounded-lg hover:bg-white/5 ${isDropTarget ? 'bg-white/10' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(todo.id)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(todo.id)
      }}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          className="checkbox w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
          aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        />
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', todo.id)
            const item = e.currentTarget.closest('li')
            if (item) {
              const rect = item.getBoundingClientRect()
              e.dataTransfer.setDragImage(
                item,
                Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
                Math.max(0, Math.min(e.clientY - rect.top, rect.height))
              )
            }
            onDragStart(todo.id)
          }}
          onDragEnd={onDragEnd}
          className="w-4 h-5 -ml-1 shrink-0 cursor-grab active:cursor-grabbing text-xs leading-none"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ⠿
        </button>
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
          ref={menuButtonRef}
          onClick={() => setMenuOpen((open) => !open)}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0 leading-none"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Task actions"
          aria-expanded={menuOpen}
          title="Task actions"
        >
          ⋯
        </button>
      </div>

      {menuMounted && createPortal(
        <div ref={menuRef} className="todo-actions no-drag p-1 text-xs" data-open={menuOpen} style={{ left: menuPosition.left, top: menuPosition.top }} aria-label="Task actions" aria-hidden={!menuOpen} inert={!menuOpen}>
          <button
            className="todo-action block w-full rounded-md px-3 py-2 text-left"
            onClick={() => {
              setMenuOpen(false)
              setReminderError(false)
              setReminderOpen((open) => !open)
            }}
          >
            ◷ &nbsp;{todo.reminderAt ? 'Change reminder' : 'Set reminder'}
          </button>
          <button
            className="todo-action block w-full rounded-md px-3 py-2 text-left text-red-500"
            onClick={() => { setMenuOpen(false); onDelete(todo.id) }}
          >
            × &nbsp;Delete
          </button>
        </div>, document.body
      )}

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
            ◷ Reminder · {new Date(todo.reminderAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
