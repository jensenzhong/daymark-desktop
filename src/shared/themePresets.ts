import type { ThemeConfig } from './types'

const FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export const THEME_PRESETS: ThemeConfig[] = [
  {
    id: 'light-glass',
    name: 'Light Glass',
    background: 'rgba(255, 255, 255, 0.55)',
    blur: 24,
    accent: '#2563eb',
    text: '#0f172a',
    textMuted: '#475569',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'dark-glass',
    name: 'Dark Glass',
    background: 'rgba(17, 24, 39, 0.55)',
    blur: 24,
    accent: '#60a5fa',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    background: 'rgba(250, 250, 249, 0.97)',
    blur: 0,
    accent: '#111827',
    text: '#111827',
    textMuted: '#6b7280',
    radius: 10,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    background: 'rgba(24, 24, 27, 0.97)',
    blur: 0,
    accent: '#a78bfa',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    radius: 10,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'claude-coral',
    name: 'Claude Coral',
    background: 'rgba(255, 239, 233, 0.96)',
    blur: 18,
    accent: '#e6755d',
    text: '#352a27',
    textMuted: '#806861',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'sage-cream',
    name: 'Sage Cream',
    background: 'rgba(242, 246, 237, 0.88)',
    blur: 24,
    accent: '#3f7059',
    text: '#20372c',
    textMuted: '#506a59',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'warm-coral',
    name: 'Warm Coral',
    background: 'rgba(255, 246, 238, 0.9)',
    blur: 24,
    accent: '#b9503f',
    text: '#3c2b27',
    textMuted: '#785c52',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'glacier-blue',
    name: 'Glacier Blue',
    background: 'rgba(235, 244, 250, 0.86)',
    blur: 24,
    accent: '#376c96',
    text: '#1e3549',
    textMuted: '#4f687d',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'midnight-amber',
    name: 'Midnight Amber',
    background: 'rgba(37, 34, 31, 0.9)',
    blur: 24,
    accent: '#e9b55e',
    text: '#f8f1e6',
    textMuted: '#c6b9a5',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  },
  {
    id: 'dusk-plum',
    name: 'Dusk Plum',
    background: 'rgba(50, 40, 49, 0.9)',
    blur: 24,
    accent: '#e5aec9',
    text: '#faf0f5',
    textMuted: '#cfb9c6',
    radius: 18,
    fontSize: 14,
    fontFamily: FONT_STACK
  }
]

export const DEFAULT_THEME_ID = 'dark-glass'

export function resolveTheme(themeId: string, customTheme: ThemeConfig): ThemeConfig {
  if (themeId === 'custom') return customTheme
  return THEME_PRESETS.find((t) => t.id === themeId) ?? THEME_PRESETS[0]
}
