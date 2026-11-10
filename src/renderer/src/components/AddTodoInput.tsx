import { useState, type KeyboardEvent } from 'react'
import type { ClipboardEvent } from 'react'
import { useLanguage } from '../lib/language'

interface AddTodoInputProps {
  onAdd: (text: string) => void
}

export function AddTodoInput({ onAdd }: AddTodoInputProps) {
  const { t } = useLanguage()
  const [value, setValue] = useState('')
  const [addedCount, setAddedCount] = useState<number | null>(null)

  const splitPastedTodos = (text: string): string[] => {
    const normalized = text.replace(/\r\n?/g, '\n').trim()
    if (!normalized.includes('\n')) return [normalized]

    const stripListMarker = (line: string): string =>
      line.replace(/^\s*(?:(?:\d{1,3}\s*[.,，、)]|[-*•])\s*)/, '').trim()

    const paragraphs = normalized
      .split(/\n(?:[\t ]*\n)+/)
      .map((paragraph) => paragraph.split('\n').map((line) => line.trim()).filter(Boolean).join(' '))
      .filter(Boolean)

    if (paragraphs.length > 1) return paragraphs.map(stripListMarker).filter(Boolean)

    const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
    const listMarker = /^\s*(?:\d{1,3}\s*[.,，、)]|[-*•])\s*/
    if (lines.length > 1 && lines.every((line) => listMarker.test(line))) {
      return lines.map(stripListMarker).filter(Boolean)
    }

    return [lines.join(' ')]
  }

  const submit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') submit()
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>): void => {
    const pasted = e.clipboardData.getData('text/plain')
    if (!pasted.includes('\n')) return

    e.preventDefault()
    const todos = splitPastedTodos(pasted)
    if (todos.length > 1) {
      todos.forEach(onAdd)
      setAddedCount(todos.length)
      return
    }

    const input = e.currentTarget
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    setValue(`${value.slice(0, start)}${todos[0] ?? ''}${value.slice(end)}`)
    setAddedCount(null)
  }

  return (
    <div className="no-drag px-4 pb-4 pt-1 shrink-0">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setAddedCount(null)
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={t('Add a todo…', '添加待办…')}
        className="todo-input w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow"
        style={{ color: 'var(--color-text)' }}
      />
      {addedCount !== null && (
        <p className="mt-1 px-1 text-xs" style={{ color: 'var(--color-accent)' }} aria-live="polite">
          {t(`Added ${addedCount} todos`, `已添加 ${addedCount} 条待办`)}
        </p>
      )}
    </div>
  )
}
