import { useSettingsStore } from '../store/useSettingsStore'

export function useLanguage() {
  const language = useSettingsStore((state) => state.settings?.language ?? 'en')
  return {
    language,
    locale: language === 'zh' ? 'zh-CN' : 'en-US',
    t: (en: string, zh: string) => language === 'zh' ? zh : en
  }
}
