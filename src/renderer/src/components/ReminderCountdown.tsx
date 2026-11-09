import { useEffect, useState } from 'react'

function countdownLabel(remainingMs: number): string {
  if (remainingMs <= 0) return '已到时间'
  const seconds = Math.ceil(remainingMs / 1000)
  if (seconds < 60) return `剩 ${seconds} 秒`

  const minutes = Math.ceil(seconds / 60)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `剩 ${days} 天${hours ? ` ${hours} 小时` : ''}`
  if (hours > 0) return `剩 ${hours} 小时${mins ? ` ${mins} 分` : ''}`
  return `剩 ${mins} 分钟`
}

export function ReminderCountdown({ reminderAt }: { reminderAt: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [reminderAt])

  const remaining = reminderAt - now
  return (
    <span className="reminder-countdown" data-urgent={remaining <= 15 * 60 * 1000}>
      {countdownLabel(remaining)}
    </span>
  )
}
