import type { Api, Settings, Todo, TodoPatch } from '../../../src/shared/types'
import { DEFAULT_THEME_ID, THEME_PRESETS } from '../../../src/shared/themePresets'

type TauriGlobal = { core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> }; event: { listen<T>(name: string, callback: (event: { payload: T }) => void): Promise<() => void> } }
const invoke = <T>(command: string, args?: Record<string, unknown>): Promise<T> =>
  (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__.core.invoke<T>(command, args)

const defaultSettings = (): Settings => ({
  language: 'en', themeId: DEFAULT_THEME_ID,
  customTheme: { ...THEME_PRESETS[0], id: 'custom', name: 'Custom' },
  windowBounds: null, drawerBounds: null, backgroundOpacity: null,
  alwaysOnTop: true, autoHeight: true, displayMode: 'fixed'
})

function today(): string {
  const date = new Date()
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function makeTodo(text: string, date: string): Todo {
  return { id: crypto.randomUUID(), text, date, done: false, createdAt: Date.now(), order: 0, reminderAt: null }
}

export function installTauriApi(): void {
  let taskQueue = Promise.resolve<unknown>(undefined)
  let settingsQueue = Promise.resolve<unknown>(undefined)
  const todoListeners = new Set<() => void>()
  const heightListeners = new Set<(enabled: boolean) => void>()
  const drawerListeners = new Set<(motion: 'open' | 'close') => void>()
  void (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__.event.listen<'open' | 'close'>('drawer-motion', (event) => {
    drawerListeners.forEach((listener) => listener(event.payload))
  }).catch((error) => console.error('Drawer event subscription failed', error))
  let resizeActive = false
  let resizeStart: { x: number; y: number; moved: boolean; heightMoved: boolean } | null = null
  let resizeQueue = Promise.resolve<unknown>(undefined)
  let latestResize: { x: number; y: number } | null = null
  let resizeScheduled = false
  const resizeCommand = (command: string, args?: Record<string, unknown>): void => {
    resizeQueue = resizeQueue.then(() => invoke(command, args)).catch((error) => { console.error('Window resize failed', error) })
  }
  const scheduleResize = (x: number, y: number): void => {
    latestResize = { x, y }
    if (resizeScheduled) return
    resizeScheduled = true
    resizeQueue = resizeQueue.then(async () => {
      while (latestResize) {
        const next = latestResize
        latestResize = null
        await invoke('resize_to', next)
      }
    }).catch((error) => { console.error('Window resize failed', error) }).finally(() => { resizeScheduled = false })
  }
  let settingsCache: Settings | null = null

  const taskCommand = <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    const result = taskQueue.then(() => invoke<T>(command, args))
    taskQueue = result.catch(() => undefined)
    return result
  }
  const getSettings = async (): Promise<Settings> => {
    const saved = await invoke<Partial<Settings> | null>('get_settings')
    return settingsCache = { ...defaultSettings(), ...(saved ?? {}) }
  }
  const patchSettings = (patch: Partial<Settings>): Promise<Settings> => {
    const operation = settingsQueue.then(async () => {
      const settings = { ...(settingsCache ?? await getSettings()), ...patch }
      const saved = await invoke<Settings>('save_settings', { settings })
      settingsCache = saved
      return saved
    })
    settingsQueue = operation.catch(() => undefined)
    return operation
  }
  const notifyTodos = (): void => { for (const listener of todoListeners) listener() }
  const mutate = async (command: string, args?: Record<string, unknown>): Promise<Todo[]> => {
    const result = await taskCommand<Todo[]>(command, args)
    return result
  }
  const rollover = (): Promise<Todo[]> => taskCommand<Todo[]>('rollover_tasks', { today: today() })
  let lastDate = today()
  setInterval(() => {
    if (today() !== lastDate) { lastDate = today(); void rollover().then(notifyTodos) }
  }, 30_000)
  window.addEventListener('focus', () => { void rollover().then(notifyTodos) })

  const api: Api = {
    todos: {
      getAll: rollover,
      add: (text, date) => mutate('add_task', { todo: makeTodo(text, date) }),
      addMany: (texts, date) => mutate('add_tasks', { todos: texts.map((text) => makeTodo(text, date)) }),
      update: (id: string, patch: TodoPatch) => mutate('update_task', { id, patch }),
      toggleDone: (id) => mutate('toggle_task', { id }),
      remove: (id) => mutate('remove_task', { id }),
      reorder: (ids) => mutate('reorder_tasks', { ids }),
      onChanged: (listener) => { todoListeners.add(listener); return () => { todoListeners.delete(listener) } }
    },
    settings: {
      get: getSettings,
      setLanguage: (language) => patchSettings({ language }),
      setTheme: (themeId) => patchSettings({ themeId }),
      setCustomTheme: (customTheme) => patchSettings({ customTheme, themeId: 'custom' }),
      setBackgroundOpacity: (backgroundOpacity) => patchSettings({ backgroundOpacity }),
      setAlwaysOnTop: async (alwaysOnTop) => { await invoke('set_pinned', { pinned: alwaysOnTop }); return patchSettings({ alwaysOnTop }) },
      setAutoHeight: (autoHeight) => patchSettings({ autoHeight }),
      setDisplayMode: async (displayMode) => { await invoke('set_display_mode', { mode: displayMode }); return patchSettings({ displayMode }) }
    },
    window: {
      hide: () => { void invoke('hide_main') },
      quit: () => { void invoke('quit_app') },
      acknowledgeReminder: async () => { await invoke('confirm_reminder'); return true },
      setContentHeight: (height) => { if (settingsCache?.autoHeight !== false && !resizeActive) void invoke('set_content_height', { height }) },
      beginResize: (x, y) => { resizeActive = true; resizeStart = { x, y, moved: false, heightMoved: false }; resizeCommand('begin_resize', { x, y }) },
      resizeTo: (x, y) => {
        if (!resizeActive || !resizeStart) return
        if (Math.abs(x - resizeStart.x) > 2 || Math.abs(y - resizeStart.y) > 2) resizeStart.moved = true
        if (Math.abs(y - resizeStart.y) > 2) resizeStart.heightMoved = true
        if (resizeStart.moved) scheduleResize(x, y)
      },
      endResize: () => {
        const heightMoved = resizeStart?.heightMoved ?? false
        resizeActive = false; resizeStart = null; resizeCommand('end_resize')
        if (heightMoved) {
          if (settingsCache) settingsCache = { ...settingsCache, autoHeight: false }
          heightListeners.forEach((listener) => listener(false))
          void patchSettings({ autoHeight: false })
        }
      },
      onAutoHeightChanged: (listener) => { heightListeners.add(listener); return () => { heightListeners.delete(listener) } },
      onDrawerMotion: (listener) => { drawerListeners.add(listener); return () => { drawerListeners.delete(listener) } }
    }
  }
  window.api = api

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement | null
    if (event.button !== 0 || !target?.closest('.drag-region') || target.closest('.no-drag, button, input, select, textarea')) return
    void invoke('start_drag')
  })
}
