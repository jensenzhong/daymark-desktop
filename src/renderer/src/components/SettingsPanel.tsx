import { THEME_PRESETS, resolveTheme } from '@shared/themePresets'
import type { DisplayMode, ThemeConfig } from '@shared/types'
import { useSettingsStore } from '../store/useSettingsStore'
import { hexToRgb, parseRgba, rgbToHex, toRgba } from '../lib/color'
import { useLanguage } from '../lib/language'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t } = useLanguage()
  const settings = useSettingsStore((s) => s.settings)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setCustomTheme = useSettingsStore((s) => s.setCustomTheme)
  const setBackgroundOpacity = useSettingsStore((s) => s.setBackgroundOpacity)
  const setAutoHeight = useSettingsStore((s) => s.setAutoHeight)
  const setDisplayMode = useSettingsStore((s) => s.setDisplayMode)

  if (!settings) return null

  const active = resolveTheme(settings.themeId, settings.customTheme)
  const isCustom = settings.themeId === 'custom'
  const bg = parseRgba(active.background)

  const updateCustom = (patch: Partial<ThemeConfig>): void => {
    setCustomTheme({ ...settings.customTheme, ...patch })
  }

  const selectCustom = (): void => {
    if (!isCustom) setCustomTheme({ ...active, id: 'custom', name: 'Custom' })
  }

  return (
    <div className="settings-panel no-drag absolute inset-0 flex flex-col">
      <div className="drag-region flex items-center justify-between px-4 py-3 shrink-0">
        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('Settings', '设置')}
        </span>
        <button
          onClick={onClose}
          className="no-drag w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 leading-none"
          aria-label={t('Close settings', '关闭设置')}
        >
          ×
        </button>
      </div>

      <div className="todo-scroll flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        <div>
          <label htmlFor="language" className="block text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {t('Language', '语言')}
          </label>
          <select id="language" value={settings.language} onChange={(e) => setLanguage(e.target.value === 'zh' ? 'zh' : 'en')}
            className="todo-input display-mode-select w-full rounded-lg px-3 py-2 text-xs outline-none"
            style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-panel-bg)' }}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
        <div>
          <label htmlFor="display-mode" className="block text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {t('Display mode', '显示方式')}
          </label>
          <select
            id="display-mode"
            value={settings.displayMode ?? 'fixed'}
            onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
            className="todo-input display-mode-select w-full rounded-lg px-3 py-2 text-xs outline-none"
            style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-panel-bg)' }}
          >
            <option value="fixed">{t('Fixed window', '固定窗口')}</option>
            <option value="drawer">{t('Top drawer', '顶部抽屉')}</option>
          </select>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('Move your mouse to the top-edge handle to open the drawer. It stays on top while open.', '抽屉收起后，将鼠标移到清单对应的屏幕顶部细条即可展开；展开时保持置顶。')}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {t('Theme', '主题')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setTheme(preset.id)}
                className="rounded-lg px-3 py-2 text-left text-xs transition-colors"
                style={{
                  background: preset.background,
                  border: `${settings.themeId === preset.id ? 2 : 1}px solid ${
                    settings.themeId === preset.id ? preset.accent : 'rgba(255,255,255,0.12)'
                  }`,
                  color: preset.text
                }}
              >
                {t(preset.name, ({ 'light-glass': '浅色玻璃', 'dark-glass': '深色玻璃', 'minimal-light': '极简浅色', 'minimal-dark': '极简深色', 'claude-coral': '珊瑚红', 'sage-cream': '鼠尾草绿', 'warm-coral': '奶油珊瑚', 'glacier-blue': '冰川蓝', 'midnight-amber': '午夜暖金', 'dusk-plum': '暮色梅紫' } as Record<string, string>)[preset.id] ?? preset.name)}
              </button>
            ))}
            <button
              onClick={selectCustom}
              className="rounded-lg px-3 py-2 text-left text-xs"
              style={{
                background: settings.customTheme.background,
                border: `${isCustom ? 2 : 1}px solid ${isCustom ? settings.customTheme.accent : 'rgba(255,255,255,0.12)'}`,
                color: settings.customTheme.text
              }}
            >
              {t('Custom', '自定义')}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>{t('Widget opacity', '窗口不透明度')}</span>
            <span>{Math.round((settings.backgroundOpacity ?? bg.a) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={settings.backgroundOpacity ?? bg.a}
            onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
            className="w-full mt-1"
            aria-label={t('Widget opacity', '窗口不透明度')}
          />
          {settings.backgroundOpacity != null && (
            <button
              onClick={() => setBackgroundOpacity(null)}
              className="mt-1 text-xs hover:underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('Use theme default', '使用主题默认值')}
            </button>
          )}
        </div>

        <label className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>{t('Auto-fit height to task list', '高度自动适应清单')}</span>
          <input
            type="checkbox"
            checked={settings.autoHeight ?? true}
            onChange={(e) => setAutoHeight(e.target.checked)}
            className="checkbox h-4 w-4 cursor-pointer"
          />
        </label>

        {isCustom && (
          <div className="space-y-4">
            <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('Accent color', '强调色')}
              <input
                type="color"
                value={active.accent}
                onChange={(e) => updateCustom({ accent: e.target.value })}
                className="block w-full h-8 mt-1 rounded-md bg-transparent cursor-pointer"
              />
            </label>

            <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('Background color', '背景色')}
              <input
                type="color"
                value={rgbToHex(bg.r, bg.g, bg.b)}
                onChange={(e) => {
                  const { r, g, b } = hexToRgb(e.target.value)
                  updateCustom({ background: toRgba(r, g, b, bg.a) })
                }}
                className="block w-full h-8 mt-1 rounded-md bg-transparent cursor-pointer"
              />
            </label>

            <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('Blur', '模糊')} ({active.blur}px)
              <input
                type="range"
                min={0}
                max={40}
                step={2}
                value={active.blur}
                onChange={(e) => updateCustom({ blur: Number(e.target.value) })}
                className="w-full mt-1"
              />
            </label>

            <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('Corner radius', '圆角')} ({active.radius}px)
              <input
                type="range"
                min={0}
                max={28}
                step={1}
                value={active.radius}
                onChange={(e) => updateCustom({ radius: Number(e.target.value) })}
                className="w-full mt-1"
              />
            </label>

            <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('Font size', '字号')} ({active.fontSize}px)
              <input
                type="range"
                min={12}
                max={18}
                step={1}
                value={active.fontSize}
                onChange={(e) => updateCustom({ fontSize: Number(e.target.value) })}
                className="w-full mt-1"
              />
            </label>
          </div>
        )}

        <button
          onClick={() => window.api.window.quit()}
          className="w-full text-xs text-left px-3 py-2 rounded-lg hover:bg-white/10"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t('Quit Daymark', '退出 Daymark')}
        </button>
      </div>
    </div>
  )
}
