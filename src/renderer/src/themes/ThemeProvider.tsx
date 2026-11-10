import { useEffect, type ReactNode } from 'react'
import { resolveTheme } from '@shared/themePresets'
import { parseRgba, toRgba } from '../lib/color'
import { useSettingsStore } from '../store/useSettingsStore'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps): ReactNode {
  const settings = useSettingsStore((s) => s.settings)

  useEffect(() => {
    if (!settings) return
    const theme = resolveTheme(settings.themeId, settings.customTheme)
    const root = document.documentElement.style
    const themeBackground = parseRgba(theme.background)
    const background = toRgba(
      themeBackground.r,
      themeBackground.g,
      themeBackground.b,
      settings.backgroundOpacity ?? themeBackground.a
    )
    root.setProperty('--color-bg', background)
    // Opaque background for menus and native select options.
    const { r, g, b } = themeBackground
    root.setProperty('--color-panel-bg', `rgba(${r}, ${g}, ${b}, 0.97)`)
    root.setProperty('--blur', `${theme.blur}px`)
    root.setProperty('--color-accent', theme.accent)
    root.setProperty('--color-text', theme.text)
    root.setProperty('--color-text-muted', theme.textMuted)
    root.setProperty('--radius', `${theme.radius}px`)
    root.setProperty('--font-size', `${theme.fontSize}px`)
    root.setProperty('--font-family', theme.fontFamily)
  }, [settings])

  return <>{children}</>
}
