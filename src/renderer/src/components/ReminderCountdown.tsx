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
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [reminderAt])

  const remaining = reminderAt - now
  return (
    <span className="reminder-countdown" data-urgent={remaining <= 15 * 60 * 1000}>
      {countdownLabel(remaining, language)}
    </span>
  )
}
