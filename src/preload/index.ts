import { contextBridge, ipcRenderer } from 'electron'
import type { Api, DisplayMode, ThemeConfig, TodoPatch } from '../shared/types'

const api: Api = {
  todos: {
    getAll: () => ipcRenderer.invoke('todos:getAll'),
    add: (text: string, date: string) => ipcRenderer.invoke('todos:add', text, date),
    update: (id: string, patch: TodoPatch) => ipcRenderer.invoke('todos:update', id, patch),
    toggleDone: (id: string) => ipcRenderer.invoke('todos:toggleDone', id),
    remove: (id: string) => ipcRenderer.invoke('todos:delete', id),
    reorder: (ids: string[]) => ipcRenderer.invoke('todos:reorder', ids),
    onChanged: (callback: () => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('todos:changed', listener)
      return () => ipcRenderer.removeListener('todos:changed', listener)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setLanguage: (language) => ipcRenderer.invoke('settings:setLanguage', language),
    setTheme: (themeId: string) => ipcRenderer.invoke('settings:setTheme', themeId),
    setCustomTheme: (theme: ThemeConfig) => ipcRenderer.invoke('settings:setCustomTheme', theme),
    setBackgroundOpacity: (opacity: number | null) =>
      ipcRenderer.invoke('settings:setBackgroundOpacity', opacity),
    setAlwaysOnTop: (pinned: boolean) => ipcRenderer.invoke('settings:setAlwaysOnTop', pinned),
    setAutoHeight: (enabled: boolean) => ipcRenderer.invoke('settings:setAutoHeight', enabled),
    setDisplayMode: (mode: DisplayMode) => ipcRenderer.invoke('settings:setDisplayMode', mode)
  },
  window: {
    hide: () => ipcRenderer.send('window:hide'),
    quit: () => ipcRenderer.send('window:quit'),
    acknowledgeReminder: (id: string) => ipcRenderer.invoke('reminder:acknowledge', id),
    setContentHeight: (height: number) => ipcRenderer.send('window:setContentHeight', height),
    beginResize: (x, y) => ipcRenderer.send('window:beginResize', x, y),
    resizeTo: (x, y) => ipcRenderer.send('window:resizeTo', x, y),
    endResize: () => ipcRenderer.send('window:endResize'),
    onDrawerMotion: (callback: (motion: 'open' | 'close') => void) => {
      const listener = (_event: Electron.IpcRendererEvent, motion: 'open' | 'close'): void => callback(motion)
      ipcRenderer.on('window:drawerMotion', listener)
      return () => ipcRenderer.removeListener('window:drawerMotion', listener)
    },
    onAutoHeightChanged: (callback: (enabled: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void => callback(enabled)
      ipcRenderer.on('window:autoHeight', listener)
      return () => ipcRenderer.removeListener('window:autoHeight', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
