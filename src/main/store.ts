import { app, dialog } from 'electron'
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { DisplayMode, Language, Settings, Todo, ThemeConfig, TodoPatch, WindowBounds } from '../shared/types'
import { THEME_PRESETS, DEFAULT_THEME_ID } from '../shared/themePresets'

const dataDir = (): string => app.getPath('userData')
const todosPath = (): string => join(dataDir(), 'todos.json')
const settingsPath = (): string => join(dataDir(), 'settings.json')

function ensureDataDir(): void {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

const reportedErrors = new Set<string>()

function reportStorageError(path: string, action: string, error: unknown): never {
  if (!reportedErrors.has(path)) {
    reportedErrors.add(path)
    dialog.showErrorBox('Daymark data error / 数据错误',
      `Could not ${action} ${path}. Your existing data has not been replaced. Check the file and its .bak backup.\n\n无法${action === 'read' ? '读取' : '保存'}数据，请检查原文件及其 .bak 备份。`)
  }
  throw error instanceof Error ? error : new Error(String(error))
}

function readJson<T>(path: string, fallback: T, validate: (value: unknown) => boolean): T {
  try {
    if (!existsSync(path)) {
      if (existsSync(`${path}.bak`)) throw new Error(`Missing data file with backup: ${path}`)
      return fallback
    }
    const value: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (!validate(value)) throw new Error(`Invalid data format: ${path}`)
    return value as T
  } catch (error) {
    return reportStorageError(path, 'read', error)
  }
}

function writeJson(path: string, data: unknown): void {
  const temp = `${path}.${randomUUID()}.tmp`
  const backupTemp = `${path}.${randomUUID()}.bak.tmp`
  try {
    ensureDataDir()
    const fd = openSync(temp, 'wx')
    try {
      writeFileSync(fd, JSON.stringify(data, null, 2), 'utf-8')
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    if (existsSync(path)) {
      copyFileSync(path, backupTemp)
      renameSync(backupTemp, `${path}.bak`)
    }
    renameSync(temp, path)
  } catch (error) {
    for (const file of [temp, backupTemp]) {
      try { if (existsSync(file)) unlinkSync(file) } catch { /* Preserve the original error. */ }
    }
    reportStorageError(path, 'write', error)
  }
}

// -- Todos --

export function readTodos(): Todo[] {
  return readJson<Todo[]>(todosPath(), [], Array.isArray)
}

const todoListeners = new Set<(todos: Todo[]) => void>()

export function onTodosChanged(listener: (todos: Todo[]) => void): () => void {
  todoListeners.add(listener)
  return () => todoListeners.delete(listener)
}

function writeTodos(todos: Todo[]): void {
  writeJson(todosPath(), todos)
  for (const listener of todoListeners) listener(todos)
}

export function addTodo(text: string, date: string): Todo[] {
  return addTodos([text], date)
}

export function addTodos(texts: string[], date: string): Todo[] {
  const clean = texts.map((text) => text.trim()).filter(Boolean)
  const todos = readTodos()
  if (clean.length === 0) return todos
  let order = todos.reduce((max, todo) => todo.date === date ? Math.max(max, todo.order) : max, -1) + 1
  for (const text of clean) {
    todos.push({ id: randomUUID(), text, done: false, date, createdAt: Date.now(), order: order++ })
  }
  writeTodos(todos)
  return todos
}

export function updateTodo(id: string, patch: TodoPatch): Todo[] {
  const todos = readTodos().map((t) => (t.id === id ? { ...t, ...patch } : t))
  writeTodos(todos)
  return todos
}

export function toggleTodoDone(id: string): Todo[] {
  const todos = readTodos().map((t) =>
    t.id === id
      ? { ...t, done: !t.done, reminderAt: !t.done ? null : t.reminderAt }
      : t
  )
  writeTodos(todos)
  return todos
}

export function deleteTodo(id: string): Todo[] {
  const todos = readTodos().filter((t) => t.id !== id)
  writeTodos(todos)
  return todos
}

export function reorderTodos(ids: string[]): Todo[] {
  const orderById = new Map(ids.map((id, order) => [id, order]))
  const todos = readTodos().map((todo) =>
    orderById.has(todo.id) ? { ...todo, order: orderById.get(todo.id)! } : todo
  )
  writeTodos(todos)
  return todos
}

export function rolloverIncompleteTodos(today: string): Todo[] {
  const todos = readTodos()
  const overdue = todos
    .filter((todo) => !todo.done && todo.date < today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)

  if (overdue.length === 0) return todos

  const currentDayOrders = todos.filter((todo) => todo.date === today).map((todo) => todo.order)
  let nextOrder = currentDayOrders.length > 0 ? Math.max(...currentDayOrders) + 1 : 0
  const overdueIds = new Set(overdue.map((todo) => todo.id))
  const rolled = todos.map((todo) => {
    if (!overdueIds.has(todo.id)) return todo
    return { ...todo, date: today, order: nextOrder++ }
  })

  writeTodos(rolled)
  return rolled
}

// -- Settings --

function defaultSettings(): Settings {
  const base = THEME_PRESETS[0]
  return {
    language: 'en',
    themeId: DEFAULT_THEME_ID,
    customTheme: { ...base, id: 'custom', name: 'Custom' },
    windowBounds: null,
    alwaysOnTop: true,
    autoHeight: true,
    displayMode: 'fixed',
    drawerBounds: null,
    backgroundOpacity: null
  }
}

export function readSettings(): Settings {
  const defaults = defaultSettings()
  const saved = readJson<Partial<Settings> | null>(settingsPath(), null, (value) => value !== null && typeof value === 'object' && !Array.isArray(value))
  if (!saved) return defaults
  return {
    ...defaults,
    ...saved,
    language: saved.language === 'zh' ? 'zh' : 'en',
    customTheme: saved.customTheme ?? defaults.customTheme,
    windowBounds: saved.windowBounds ?? null,
    alwaysOnTop: saved.alwaysOnTop ?? true,
    autoHeight: saved.autoHeight ?? true,
    displayMode: saved.displayMode === 'drawer' ? 'drawer' : 'fixed',
    drawerBounds: saved.drawerBounds ?? null,
    backgroundOpacity: saved.backgroundOpacity ?? null
  }
}

function writeSettings(settings: Settings): void {
  writeJson(settingsPath(), settings)
}

export function setLanguage(language: Language): Settings {
  const settings = readSettings()
  settings.language = language
  writeSettings(settings)
  return settings
}

export function setTheme(themeId: string): Settings {
  const settings = readSettings()
  settings.themeId = themeId
  writeSettings(settings)
  return settings
}

export function setCustomTheme(theme: ThemeConfig): Settings {
  const settings = readSettings()
  settings.customTheme = theme
  settings.themeId = 'custom'
  writeSettings(settings)
  return settings
}

export function setBackgroundOpacity(opacity: number | null): Settings {
  const settings = readSettings()
  settings.backgroundOpacity = opacity
  writeSettings(settings)
  return settings
}

export function setAlwaysOnTop(pinned: boolean): Settings {
  const settings = readSettings()
  settings.alwaysOnTop = pinned
  writeSettings(settings)
  return settings
}

export function setAutoHeight(enabled: boolean): Settings {
  const settings = readSettings()
  settings.autoHeight = enabled
  writeSettings(settings)
  return settings
}

let boundsWriteTimer: ReturnType<typeof setTimeout> | null = null
export function setDisplayMode(mode: DisplayMode, bounds: WindowBounds | null): Settings {
  if (boundsWriteTimer) clearTimeout(boundsWriteTimer)
  boundsWriteTimer = null
  const settings = readSettings()
  if (bounds) {
    if (settings.displayMode === 'drawer') settings.drawerBounds = bounds
    else settings.windowBounds = bounds
  }
  settings.displayMode = mode
  writeSettings(settings)
  return settings
}

export function writeWindowBounds(bounds: WindowBounds, mode: DisplayMode = 'fixed'): void {
  if (boundsWriteTimer) clearTimeout(boundsWriteTimer)
  boundsWriteTimer = setTimeout(() => {
    const settings = readSettings()
    if (mode === 'drawer') settings.drawerBounds = bounds
    else settings.windowBounds = bounds
    writeSettings(settings)
  }, 400)
}
