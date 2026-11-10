import { BrowserWindow, app, ipcMain } from 'electron'
import type { DisplayMode, ThemeConfig, TodoPatch } from '../shared/types'
import * as store from './store'
import { markQuitting } from './appState'
import { dismissActiveReminder } from './reminders'
import { setWidgetAutoHeight, setWidgetContentHeight, setWidgetDisplayMode } from './window'
import { refreshTrayMenu } from './tray'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  let resizeStart: { x: number; y: number; width: number; height: number } | null = null
  ipcMain.handle('todos:getAll', () => store.readTodos())
  const addMany = (texts: string[], date: string) => {
    const todos = store.addTodos(texts, date)
    if (!(store.readSettings().autoHeight ?? true)) {
      store.setAutoHeight(true)
      setWidgetAutoHeight(getWindow(), true)
      getWindow()?.webContents.send('window:autoHeight', true)
    }
    return todos
  }
  ipcMain.handle('todos:add', (_e, text: string, date: string) => addMany([text], date))
  ipcMain.handle('todos:addMany', (_e, texts: string[], date: string) => addMany(texts, date))
  ipcMain.handle('todos:update', (_e, id: string, patch: TodoPatch) => store.updateTodo(id, patch))
  ipcMain.handle('todos:toggleDone', (_e, id: string) => store.toggleTodoDone(id))
  ipcMain.handle('todos:delete', (_e, id: string) => store.deleteTodo(id))
  ipcMain.handle('todos:reorder', (_e, ids: string[]) => store.reorderTodos(ids))

  ipcMain.handle('reminder:acknowledge', (_e, id: string) => {
    store.updateTodo(id, { reminderAt: null })
    getWindow()?.webContents.send('todos:changed')
    dismissActiveReminder(id)
    return true
  })

  ipcMain.handle('settings:get', () => store.readSettings())
  ipcMain.handle('settings:setLanguage', (_e, language: unknown) => {
    if (language !== 'en' && language !== 'zh') return store.readSettings()
    const settings = store.setLanguage(language)
    refreshTrayMenu()
    return settings
  })
  ipcMain.handle('settings:setTheme', (_e, themeId: string) => store.setTheme(themeId))
  ipcMain.handle('settings:setCustomTheme', (_e, theme: ThemeConfig) => store.setCustomTheme(theme))
  ipcMain.handle('settings:setBackgroundOpacity', (_e, opacity: number | null) =>
    store.setBackgroundOpacity(opacity)
  )
  ipcMain.handle('settings:setAlwaysOnTop', (_e, pinned: boolean) => {
    const settings = store.setAlwaysOnTop(pinned)
    getWindow()?.setAlwaysOnTop(settings.displayMode === 'drawer' || pinned, 'floating')
    return settings
  })
  ipcMain.handle('settings:setAutoHeight', (_e, enabled: boolean) => {
    const settings = store.setAutoHeight(enabled)
    setWidgetAutoHeight(getWindow(), enabled)
    getWindow()?.webContents.send('window:autoHeight', enabled)
    return settings
  })
  ipcMain.handle('settings:setDisplayMode', (_e, mode: DisplayMode) => {
    if (mode !== 'fixed' && mode !== 'drawer') return store.readSettings()
    return setWidgetDisplayMode(getWindow(), mode)
  })

  ipcMain.on('window:hide', () => getWindow()?.hide())
  ipcMain.on('window:beginResize', (_e, x: number, y: number) => {
    const win = getWindow()
    if (!win || !Number.isFinite(x) || !Number.isFinite(y)) return
    const { width, height } = win.getBounds()
    resizeStart = { x, y, width, height }
  })
  ipcMain.on('window:resizeTo', (_e, x: number, y: number) => {
    const win = getWindow()
    if (!win || !resizeStart || !Number.isFinite(x) || !Number.isFinite(y)) return
    const deltaY = y - resizeStart.y
    if (Math.abs(deltaY) > 2 && (store.readSettings().autoHeight ?? true)) {
      store.setAutoHeight(false)
      setWidgetAutoHeight(win, false)
      win.webContents.send('window:autoHeight', false)
    }
    win.setSize(Math.max(180, Math.round(resizeStart.width + x - resizeStart.x)), Math.max(140, Math.round(resizeStart.height + deltaY)))
  })
  ipcMain.on('window:endResize', () => { resizeStart = null })
  ipcMain.on('window:setContentHeight', (_e, height: number) => {
    const win = getWindow()
    if (win) setWidgetContentHeight(win, height)
  })
  ipcMain.on('window:quit', () => {
    markQuitting()
    app.quit()
  })
}
