import { useState } from 'react'
import { addDays, formatDisplayDate } from '../lib/date'
import { CalendarPopover } from './CalendarPopover'

interface DateNavProps {
  selectedDate: string
  onChange: (date: string) => void
  todoDates: string[]
}

export function DateNav({ selectedDate, onChange, todoDates }: DateNavProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  return (
    <div className="no-drag date-nav flex flex-1 min-w-0 items-center justify-center">
      <button
        onClick={() => onChange(addDays(selectedDate, -1))}
        className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center hover:bg-white/10 leading-none"
        aria-label="Previous day"
      >
        ‹
      </button>
      <button
        onClick={() => setCalendarOpen((open) => !open)}
        className="text-sm font-medium px-1 py-0.5 min-w-0 truncate rounded-md hover:bg-white/10"
        style={{ color: 'var(--color-text-muted)' }}
        title={formatDisplayDate(selectedDate)}
        aria-label="打开日历选择日期"
        aria-expanded={calendarOpen}
        id="calendar-trigger"
      >
        {formatDisplayDate(selectedDate)}
      </button>
      {calendarOpen && (
        <CalendarPopover
          selectedDate={selectedDate}
          todoDates={todoDates}
          onSelect={(date) => { onChange(date); setCalendarOpen(false) }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
      <button
        onClick={() => onChange(addDays(selectedDate, 1))}
        className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center hover:bg-white/10 leading-none"
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  )
}
