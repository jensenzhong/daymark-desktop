import { BrowserWindow, app, ipcMain } from 'electron'
import type { ThemeConfig, TodoPatch } from '../shared/types'
import * as store from './store'
import { markQuitting } from './appState'
import { dismissActiveReminder } from './reminders'
import { setWidgetAutoHeight, setWidgetContentHeight } from './window'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('todos:getAll', () => store.readTodos())
  ipcMain.handle('todos:add', (_e, text: string, date: string) => {
    const todos = store.addTodo(text, date)
    if (!(store.readSettings().autoHeight ?? true)) {
      store.setAutoHeight(true)
      setWidgetAutoHeight(getWindow(), true)
      getWindow()?.webContents.send('window:autoHeight', true)
    }
    return todos
  })
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
  ipcMain.handle('settings:setTheme', (_e, themeId: string) => store.setTheme(themeId))
  ipcMain.handle('settings:setCustomTheme', (_e, theme: ThemeConfig) => store.setCustomTheme(theme))
  ipcMain.handle('settings:setBackgroundOpacity', (_e, opacity: number | null) =>
    store.setBackgroundOpacity(opacity)
  )
  ipcMain.handle('settings:setAlwaysOnTop', (_e, pinned: boolean) => {
    const settings = store.setAlwaysOnTop(pinned)
    getWindow()?.setAlwaysOnTop(pinned, 'floating')
    return settings
  })

  ipcMain.on('window:hide', () => getWindow()?.hide())
  ipcMain.on('window:setContentHeight', (_e, height: number) => {
    const win = getWindow()
    if (win) setWidgetContentHeight(win, height)
  })
  ipcMain.on('window:quit', () => {
    markQuitting()
    app.quit()
  })
}
