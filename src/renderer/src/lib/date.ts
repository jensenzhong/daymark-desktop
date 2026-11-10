export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return toDateKey(date)
}

export function formatDisplayDate(dateKey: string, language: 'en' | 'zh' = 'en'): string {
  const today = todayKey()
  if (dateKey === today) return language === 'zh' ? '今天' : 'Today'
  if (dateKey === addDays(today, -1)) return language === 'zh' ? '昨天' : 'Yesterday'
  if (dateKey === addDays(today, 1)) return language === 'zh' ? '明天' : 'Tomorrow'
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
