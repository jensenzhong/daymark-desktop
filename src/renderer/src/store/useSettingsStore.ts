import { create } from 'zustand'
import type { DisplayMode, Settings, ThemeConfig } from '@shared/types'

interface SettingsState {
  settings: Settings | null
  loaded: boolean
  load: () => Promise<void>
  setTheme: (themeId: string) => Promise<void>
  setCustomTheme: (theme: ThemeConfig) => Promise<void>
  setBackgroundOpacity: (opacity: number | null) => Promise<void>
  setAlwaysOnTop: (pinned: boolean) => Promise<void>
  setAutoHeight: (enabled: boolean) => Promise<void>
  setDisplayMode: (mode: DisplayMode) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loaded: false,
  load: async () => {
    const settings = await window.api.settings.get()
    set({ settings, loaded: true })
  },
  setTheme: async (themeId) => {
    const settings = await window.api.settings.setTheme(themeId)
    set({ settings })
  },
  setCustomTheme: async (theme) => {
    const settings = await window.api.settings.setCustomTheme(theme)
    set({ settings })
  },
  setBackgroundOpacity: async (opacity) => {
    const settings = await window.api.settings.setBackgroundOpacity(opacity)
    set({ settings })
  },
  setAlwaysOnTop: async (pinned) => {
    const settings = await window.api.settings.setAlwaysOnTop(pinned)
    set({ settings })
  },
  setAutoHeight: async (enabled) => {
    const settings = await window.api.settings.setAutoHeight(enabled)
    set({ settings })
  },
  setDisplayMode: async (mode) => {
    const settings = await window.api.settings.setDisplayMode(mode)
    set({ settings })
  }
}))
