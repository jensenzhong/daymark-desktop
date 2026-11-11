import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Todo } from '@shared/types'
import { ReminderCountdown } from './ReminderCountdown'
import { useLanguage } from '../lib/language'

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onSetReminder: (id: string, reminderAt: number | null) => Promise<void>
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
  const { locale, t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderError, setReminderError] = useState<'invalid' | 'save' | null>(null)
  const [reminderValue, setReminderValue] = useState('')
  const [reminderSaving, setReminderSaving] = useState(false)
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
    const left = Math.max(margin, Math.min(anchor.right - menu.width, window.innerWidth - menu.width - margin))
    const top = Math.max(margin, Math.min(anchor.top + (anchor.height - menu.height) / 2, window.innerHeight - menu.height - margin))
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
          aria-label={todo.done ? t('Mark as not done', '标记为未完成') : t('Mark as done', '标记为已完成')}
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
          aria-label={t('Drag to reorder', '拖动调整顺序')}
          title={t('Drag to reorder', '拖动调整顺序')}
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
          aria-label={t('Task actions', '待办操作')}
          aria-expanded={menuOpen}
          title={t('Task actions', '待办操作')}
        >
          ⋯
        </button>
      </div>

      {menuMounted && createPortal(
        <div ref={menuRef} className="todo-actions no-drag" data-open={menuOpen} style={{ left: menuPosition.left, top: menuPosition.top }} role="group" aria-label={t('Task actions', '待办操作')} aria-hidden={!menuOpen} inert={!menuOpen}>
          <button
            className="todo-action"
            aria-label={todo.reminderAt ? t('Change reminder', '修改提醒') : t('Set reminder', '设置提醒')}
            title={todo.reminderAt ? t('Change reminder', '修改提醒') : t('Set reminder', '设置提醒')}
            onClick={() => {
              setMenuOpen(false)
              setReminderError(null)
              setReminderValue(todo.reminderAt ? toLocalDateTimeInput(todo.reminderAt) : '')
              setReminderOpen((open) => !open)
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></svg>
          </button>
          <button
            className="todo-action todo-action-delete"
            aria-label={t('Delete todo', '删除待办')}
            title={t('Delete todo', '删除待办')}
            onClick={() => { setMenuOpen(false); onDelete(todo.id) }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3m-8 0 1 12h8l1-12M10 10v6m4-6v6" /></svg>
          </button>
        </div>, document.body
      )}

      {reminderOpen && (
        <div className="ml-6 flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('Remind me at', '提醒时间')}
            <input
              type="datetime-local"
              min={toLocalDateTimeInput(Date.now() + 60_000)}
              value={reminderValue}
              onChange={(e) => {
                setReminderValue(e.target.value)
                setReminderError(null)
              }}
              className="block w-full mt-1 rounded-md px-2 py-1 text-xs"
              style={{
                color: 'var(--color-text)',
                colorScheme: 'dark',
                background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-text) 14%, transparent)'
              }}
              aria-label={t('Reminder date and time', '提醒日期和时间')}
            />
          </label>
          {reminderError && <span className="text-xs text-red-400" role="alert">{reminderError === 'invalid' ? t('Choose a future time.', '请选择未来的时间。') : t('Could not save reminder. Try again.', '保存失败，请重试。')}</span>}
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" disabled={reminderSaving} onClick={() => { setReminderOpen(false); setReminderError(null) }}
              className="rounded-md px-3 py-1 text-xs hover:bg-white/10" style={{ color: 'var(--color-text-muted)' }}>
              {t('Cancel', '取消')}
            </button>
            <button type="button" disabled={reminderSaving} onClick={async () => {
              const reminderAt = reminderValue ? new Date(reminderValue).getTime() : NaN
              if (!Number.isFinite(reminderAt) || reminderAt <= Date.now()) {
                setReminderError('invalid')
                return
              }
              setReminderSaving(true)
              try {
                await onSetReminder(todo.id, reminderAt)
                setReminderOpen(false)
                setReminderError(null)
              } catch {
                setReminderError('save')
              } finally {
                setReminderSaving(false)
              }
            }} className="rounded-md px-3 py-1 text-xs font-medium" style={{ background: 'var(--color-accent)', color: 'var(--color-panel-bg)' }}>
              {t('Confirm', '确认')}
            </button>
          </div>
        </div>
      )}

      {todo.reminderAt && !reminderOpen && (
        <div className="reminder-line ml-6 flex min-w-0 items-center gap-1 text-xs" style={{ color: 'var(--color-accent)' }}>
          <span className="min-w-0 truncate" title={new Date(todo.reminderAt).toLocaleString(locale)}>
            ◷ {new Date(todo.reminderAt).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
          </span>
          <button
            onClick={() => onSetReminder(todo.id, null)}
            className="shrink-0 rounded px-1 hover:bg-white/10"
            aria-label={t('Remove reminder', '移除提醒')}
            title={t('Remove reminder', '移除提醒')}
          >
            ×
          </button>
          <ReminderCountdown reminderAt={todo.reminderAt} />
        </div>
      )}
    </li>
  )
}
