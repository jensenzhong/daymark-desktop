import { useState, type KeyboardEvent } from 'react'
import type { ClipboardEvent } from 'react'
import { useLanguage } from '../lib/language'

interface AddTodoInputProps {
  onAdd: (text: string) => Promise<void>
  onAddMany: (texts: string[]) => Promise<void>
}

export function AddTodoInput({ onAdd, onAddMany }: AddTodoInputProps) {
  const { t } = useLanguage()
  const [value, setValue] = useState('')
  const [addedCount, setAddedCount] = useState<number | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const submit = async (): Promise<void> => {
    const trimmed = value.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await onAdd(trimmed)
      setValue((current) => current === value ? '' : current)
      setSaveError(false)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') void submit()
  }

  const handlePaste = async (e: ClipboardEvent<HTMLInputElement>): Promise<void> => {
    const pasted = e.clipboardData.getData('text/plain')
    if (!pasted.includes('\n')) return

    e.preventDefault()
    const todos = splitPastedTodos(pasted)
    if (todos.length > 1) {
      if (saving) return
      setSaving(true)
      try {
        await onAddMany(todos)
        setAddedCount(todos.length)
        setSaveError(false)
      } catch {
        setValue((current) => [current, ...todos].filter(Boolean).join('； '))
        setSaveError(true)
      } finally {
        setSaving(false)
      }
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
          setSaveError(false)
        }}
        onKeyDown={handleKeyDown}
        onPaste={(e) => { void handlePaste(e) }}
        placeholder={t('Add a todo…', '添加待办…')}
        className="todo-input w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow"
        style={{ color: 'var(--color-text)' }}
      />
      {addedCount !== null && (
        <p className="mt-1 px-1 text-xs" style={{ color: 'var(--color-accent)' }} aria-live="polite">
          {t(`Added ${addedCount} todos`, `已添加 ${addedCount} 条待办`)}
        </p>
      )}
      {saveError && (
        <p className="mt-1 px-1 text-xs text-red-500" role="alert">
          {t('Could not save. Your input is still available.', '保存失败，输入内容仍保留。')}
        </p>
      )}
    </div>
  )
}
