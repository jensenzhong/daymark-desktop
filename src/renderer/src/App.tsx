import { useEffect, useRef, useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { DateNav } from './components/DateNav'
import { AddTodoInput } from './components/AddTodoInput'
import { TodoList } from './components/TodoList'
import { SettingsPanel } from './components/SettingsPanel'
import { ThemeProvider } from './themes/ThemeProvider'
import { useTodoStore } from './store/useTodoStore'
import { useSettingsStore } from './store/useSettingsStore'
import { todayKey } from './lib/date'
import { ReminderDialog } from './components/ReminderDialog'

export default function App() {
  const todos = useTodoStore((s) => s.todos)
  const loadTodos = useTodoStore((s) => s.load)
  const addTodo = useTodoStore((s) => s.add)
  const updateTodo = useTodoStore((s) => s.update)
  const toggleDone = useTodoStore((s) => s.toggleDone)
  const removeTodo = useTodoStore((s) => s.remove)
  const reorderTodos = useTodoStore((s) => s.reorder)

  const loadSettings = useSettingsStore((s) => s.load)
  const settings = useSettingsStore((s) => s.settings)
  const setAlwaysOnTop = useSettingsStore((s) => s.setAlwaysOnTop)
  const settingsLoaded = useSettingsStore((s) => s.loaded)

  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoHeight, setAutoHeight] = useState(true)
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--max-list-height',
      `${Math.max(80, window.screen.availHeight - 180)}px`
    )
  }, [])

  useEffect(() => {
    loadTodos()
    loadSettings()
    return window.api.todos.onChanged(() => loadTodos())
  }, [loadTodos, loadSettings])

  useEffect(() => {
    if (settingsLoaded) setAutoHeight(settings?.autoHeight ?? true)
  }, [settingsLoaded, settings?.autoHeight])

  useEffect(() => window.api.window.onAutoHeightChanged(setAutoHeight), [])

  useEffect(() => {
    if (!autoHeight || !settingsLoaded) return
    const shell = shellRef.current
    if (!shell) return

    const updateWindowHeight = (): void => {
      window.api.window.setContentHeight(Math.ceil(shell.getBoundingClientRect().height))
    }
    const observer = new ResizeObserver(updateWindowHeight)
    observer.observe(shell)
    updateWindowHeight()
    return () => observer.disconnect()
  }, [autoHeight, settingsLoaded])

  useEffect(() => {
    let observedToday = todayKey()
    const timer = setInterval(() => {
      const today = todayKey()
      if (today === observedToday) return
      observedToday = today
      setSelectedDate(today)
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  const params = new URLSearchParams(window.location.search)
  if (params.get('reminder') === '1') {
    return (
      <ReminderDialog
        id={params.get('id') ?? ''}
        text={params.get('text') ?? 'A scheduled task is due.'}
        reminderAt={Number(params.get('at'))}
      />
    )
  }

  if (!settingsLoaded) return null

  const visibleTodos = todos.filter((t) => t.date === selectedDate)

  return (
    <ThemeProvider>
      <div ref={shellRef} className={`app-shell relative ${autoHeight ? 'auto-height' : 'manual-height'}`}>
        <TitleBar
          onOpenSettings={() => setSettingsOpen(true)}
          pinned={settings?.alwaysOnTop ?? true}
          onTogglePin={() => setAlwaysOnTop(!(settings?.alwaysOnTop ?? true))}
        />
        <DateNav selectedDate={selectedDate} onChange={setSelectedDate} />
        <TodoList
          todos={visibleTodos}
          onToggle={toggleDone}
          onEdit={(id, text) => updateTodo(id, { text })}
          onDelete={removeTodo}
          onSetReminder={(id, reminderAt) => updateTodo(id, { reminderAt })}
          onReorder={(ids) => reorderTodos(ids)}
        />
        <AddTodoInput onAdd={(text) => addTodo(text, selectedDate)} />
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>
    </ThemeProvider>
  )
}
