import { useEffect, useRef, useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { AddTodoInput } from './components/AddTodoInput'
import { TodoList } from './components/TodoList'
import { SettingsPanel } from './components/SettingsPanel'
import { ThemeProvider } from './themes/ThemeProvider'
import { useTodoStore } from './store/useTodoStore'
import { useSettingsStore } from './store/useSettingsStore'
import { todayKey } from './lib/date'
import { ReminderDialog } from './components/ReminderDialog'
import { useLanguage } from './lib/language'

export default function App() {
  const { language, t } = useLanguage()
  const todos = useTodoStore((s) => s.todos)
  const loadTodos = useTodoStore((s) => s.load)
  const addTodo = useTodoStore((s) => s.add)
  const addManyTodos = useTodoStore((s) => s.addMany)
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
  const [drawerMotion, setDrawerMotion] = useState<'open' | 'close' | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  useEffect(() => {
    loadTodos()
    loadSettings()
    return window.api.todos.onChanged(() => loadTodos())
  }, [loadTodos, loadSettings])

  useEffect(() => {
    if (settingsLoaded) setAutoHeight(settings?.autoHeight ?? true)
  }, [settingsLoaded, settings?.autoHeight])

  useEffect(() => window.api.window.onAutoHeightChanged((enabled) => {
    setAutoHeight(enabled)
    useSettingsStore.setState((state) => ({
      settings: state.settings ? { ...state.settings, autoHeight: enabled } : state.settings
    }))
  }), [])

  useEffect(() => window.api.window.onDrawerMotion(setDrawerMotion), [])

  useEffect(() => {
    if (!autoHeight || !settingsLoaded) return
    const shell = shellRef.current
    if (!shell) return

    const updateWindowHeight = (): void => {
      const list = shell.querySelector<HTMLElement>('.todo-scroll, .todo-content-empty')
      if (!list) return
      const listHeight = list.classList.contains('todo-content-empty') ? 56 : list.scrollHeight
      window.api.window.setContentHeight(Math.ceil(shell.clientHeight - list.clientHeight + listHeight + 2))
    }
    const observer = new ResizeObserver(updateWindowHeight)
    const list = shell.querySelector<HTMLElement>('.todo-scroll, .todo-content-empty')
    observer.observe(shell)
    if (list) {
      observer.observe(list)
      Array.from(list.children).forEach((child) => observer.observe(child))
    }
    updateWindowHeight()
    return () => observer.disconnect()
  }, [autoHeight, settingsLoaded, todos, selectedDate])

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
        text={params.get('text') ?? t('A scheduled task is due.', '待办提醒时间到了。')}
        reminderAt={Number(params.get('at'))}
      />
    )
  }

  if (!settingsLoaded) return null

  const visibleTodos = todos.filter((t) => t.date === selectedDate)

  return (
    <ThemeProvider>
      <div ref={shellRef} className={`app-shell relative ${autoHeight ? 'auto-height' : 'manual-height'} ${settingsOpen ? 'settings-open' : ''} ${drawerMotion ? `drawer-${drawerMotion}` : ''}`}>
        <TitleBar
          onOpenSettings={() => setSettingsOpen(true)}
          pinned={settings?.alwaysOnTop ?? true}
          onTogglePin={() => setAlwaysOnTop(!(settings?.alwaysOnTop ?? true))}
          selectedDate={selectedDate}
          onChangeDate={setSelectedDate}
          todoDates={todos.map((todo) => todo.date)}
        />
        <TodoList
          todos={visibleTodos}
          onToggle={toggleDone}
          onEdit={(id, text) => updateTodo(id, { text })}
          onDelete={removeTodo}
          onSetReminder={(id, reminderAt) => updateTodo(id, { reminderAt })}
          onReorder={(ids) => reorderTodos(ids)}
        />
        <AddTodoInput onAdd={(text) => addTodo(text, selectedDate)} onAddMany={(texts) => addManyTodos(texts, selectedDate)} />
        <div
          className="resize-grip"
          title={t('Drag to resize', '拖动调整窗口大小')}
          aria-label={t('Resize window', '调整窗口大小')}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            window.api.window.beginResize(e.screenX, e.screenY)
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) window.api.window.resizeTo(e.screenX, e.screenY)
          }}
          onPointerUp={() => window.api.window.endResize()}
          onPointerCancel={() => window.api.window.endResize()}
        />
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>
    </ThemeProvider>
  )
}
