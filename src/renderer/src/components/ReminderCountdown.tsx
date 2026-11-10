import { useEffect, useState } from 'react'
import { useLanguage } from '../lib/language'

function countdownLabel(remainingMs: number, language: 'en' | 'zh'): string {
  const t = (en: string, zh: string): string => language === 'zh' ? zh : en
  if (remainingMs <= 0) return t('Due now', '已到时间')
  const seconds = Math.ceil(remainingMs / 1000)
  if (seconds < 60) return t(`${seconds}s left`, `剩 ${seconds} 秒`)

  const minutes = Math.ceil(seconds / 60)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return t(`${days}d${hours ? ` ${hours}h` : ''} left`, `剩 ${days} 天${hours ? ` ${hours} 小时` : ''}`)
  if (hours > 0) return t(`${hours}h${mins ? ` ${mins}m` : ''} left`, `剩 ${hours} 小时${mins ? ` ${mins} 分` : ''}`)
  return t(`${mins}m left`, `剩 ${mins} 分钟`)
}

export function ReminderCountdown({ reminderAt }: { reminderAt: number }) {
  const { language } = useLanguage()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: number | undefined
    const update = (): void => {
      window.clearTimeout(timer)
      const current = Date.now()
      setNow(current)
      if (document.hidden) return
      const remaining = reminderAt - current
      if (remaining <= 0) return
      const interval = remaining <= 60_000 ? 1000 : 60_000
      let delay = remaining % interval || interval
      if (remaining > 60_000) delay = Math.min(delay, remaining - 60_000)
      if (remaining > 15 * 60_000) delay = Math.min(delay, remaining - 15 * 60_000)
      timer = window.setTimeout(update, Math.max(25, delay))
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [reminderAt])

  const remaining = reminderAt - now
  return (
    <span className="reminder-countdown" data-urgent={remaining <= 15 * 60 * 1000}>
      {countdownLabel(remaining, language)}
    </span>
  )
}
