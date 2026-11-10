export interface Todo {
  id: string
  text: string
  done: boolean
  date: string // 'YYYY-MM-DD'
  createdAt: number
  order: number
  reminderAt?: number | null
}

export interface ThemeConfig {
  id: string
  name: string
  background: string // rgba(...)
  blur: number // px
  accent: string
  text: string
  textMuted: string
  radius: number // px
  fontSize: number // px
  fontFamily: string
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export type DisplayMode = 'fixed' | 'drawer'
export type Language = 'en' | 'zh'

export interface Settings {
  language: Language
  themeId: string
  customTheme: ThemeConfig
  windowBounds: WindowBounds | null
  backgroundOpacity?: number | null
  alwaysOnTop?: boolean
  autoHeight?: boolean
  displayMode?: DisplayMode
  drawerBounds?: WindowBounds | null
}

export type TodoPatch = Partial<Pick<Todo, 'text' | 'date' | 'order' | 'reminderAt'>>

export interface TodoApi {
  getAll: () => Promise<Todo[]>
  add: (text: string, date: string) => Promise<Todo[]>
  addMany: (texts: string[], date: string) => Promise<Todo[]>
  update: (id: string, patch: TodoPatch) => Promise<Todo[]>
  toggleDone: (id: string) => Promise<Todo[]>
  remove: (id: string) => Promise<Todo[]>
  reorder: (ids: string[]) => Promise<Todo[]>
  onChanged: (callback: () => void) => () => void
}

export interface SettingsApi {
  get: () => Promise<Settings>
  setLanguage: (language: Language) => Promise<Settings>
  setTheme: (themeId: string) => Promise<Settings>
  setCustomTheme: (theme: ThemeConfig) => Promise<Settings>
  setBackgroundOpacity: (opacity: number | null) => Promise<Settings>
  setAlwaysOnTop: (pinned: boolean) => Promise<Settings>
  setAutoHeight: (enabled: boolean) => Promise<Settings>
  setDisplayMode: (mode: DisplayMode) => Promise<Settings>
}

export interface WindowApi {
  hide: () => void
  quit: () => void
  acknowledgeReminder: (id: string) => Promise<boolean>
  setContentHeight: (height: number) => void
  beginResize: (x: number, y: number) => void
  resizeTo: (x: number, y: number) => void
  endResize: () => void
  onAutoHeightChanged: (callback: (enabled: boolean) => void) => () => void
  onDrawerMotion: (callback: (motion: 'open' | 'close') => void) => () => void
}

export interface Api {
  todos: TodoApi
  settings: SettingsApi
  window: WindowApi
}
