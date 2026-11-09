import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, todayKey, toDateKey } from '../lib/date'

interface CalendarPopoverProps {
  selectedDate: string
  todoDates: string[]
  onSelect: (date: string) => void
  onClose: () => void
}

function parseDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shiftMonth(key: string, delta: number): string {
  const date = parseDate(key)
  const year = date.getFullYear()
  const month = date.getMonth() + delta
  const maxDay = new Date(year, month + 1, 0).getDate()
  return toDateKey(new Date(year, month, Math.min(date.getDate(), maxDay)))
}

export function CalendarPopover({ selectedDate, todoDates, onSelect, onClose }: CalendarPopoverProps) {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [cursor, setCursor] = useState(selectedDate)
  const [position, setPosition] = useState({ left: 8, top: 50 })
  const panelRef = useRef<HTMLDivElement>(null)
  const datesWithTodos = new Set(todoDates)
  const today = todayKey()
  const cursorDate = parseDate(cursor)
  const weekStart = addDays(cursor, -((cursorDate.getDay() + 6) % 7))
  const firstOfMonth = toDateKey(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1))
  const firstDate = parseDate(firstOfMonth)
  const monthStart = addDays(firstOfMonth, -((firstDate.getDay() + 6) % 7))
  const dates = Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) =>
    addDays(view === 'month' ? monthStart : weekStart, index)
  )
  const heading = view === 'month'
    ? `${cursorDate.getFullYear()}年 ${cursorDate.getMonth() + 1}月`
    : `${parseDate(weekStart).getMonth() + 1}月${parseDate(weekStart).getDate()}日 – ${parseDate(addDays(weekStart, 6)).getMonth() + 1}月${parseDate(addDays(weekStart, 6)).getDate()}日`

  useLayoutEffect(() => {
    const anchor = document.getElementById('calendar-trigger')?.getBoundingClientRect()
    const panel = panelRef.current
    if (!anchor || !panel) return
    const width = panel.getBoundingClientRect().width
    setPosition({
      left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 8)),
      top: Math.min(anchor.bottom + 8, window.innerHeight - 76)
    })
    panel.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const dismiss = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !document.getElementById('calendar-trigger')?.contains(target)) onClose()
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
        document.getElementById('calendar-trigger')?.focus()
      }
    }
    const closeOnScroll = (event: Event): void => {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div ref={panelRef} className="calendar-popover no-drag" role="dialog" aria-label="选择日期" tabIndex={-1}
      style={{ left: position.left, top: position.top, maxHeight: `calc(100vh - ${position.top + 8}px)` }}>
      <div className="calendar-top">
        <span className="calendar-title">日历</span>
        <div className="calendar-switch" aria-label="日历视图">
          <button aria-pressed={view === 'week'} onClick={() => setView('week')}>周</button>
          <button aria-pressed={view === 'month'} onClick={() => setView('month')}>月</button>
        </div>
        <button className="calendar-today" onClick={() => onSelect(today)}>今天</button>
      </div>
      <div className="calendar-navigation">
        <button aria-label={view === 'month' ? '上个月' : '上一周'} onClick={() => setCursor(view === 'month' ? shiftMonth(cursor, -1) : addDays(cursor, -7))}>‹</button>
        <span>{heading}</span>
        <button aria-label={view === 'month' ? '下个月' : '下一周'} onClick={() => setCursor(view === 'month' ? shiftMonth(cursor, 1) : addDays(cursor, 7))}>›</button>
      </div>
      <div className="calendar-grid calendar-weekdays" aria-hidden="true">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {dates.map((date) => (
          <button key={date} className="calendar-day" data-selected={date === selectedDate} data-today={date === today}
            data-outside={view === 'month' && parseDate(date).getMonth() !== cursorDate.getMonth()}
            onClick={() => onSelect(date)} aria-label={`${date}${datesWithTodos.has(date) ? '，有待办' : ''}`} aria-pressed={date === selectedDate}>
            <span>{parseDate(date).getDate()}</span>
            {datesWithTodos.has(date) && <span className="calendar-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>, document.body
  )
}
