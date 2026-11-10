import { useState } from 'react'
import { addDays, formatDisplayDate } from '../lib/date'
import { CalendarPopover } from './CalendarPopover'
import { useLanguage } from '../lib/language'

interface DateNavProps {
  selectedDate: string
  onChange: (date: string) => void
  todoDates: string[]
}

export function DateNav({ selectedDate, onChange, todoDates }: DateNavProps) {
  const { language, t } = useLanguage()
  const [calendarOpen, setCalendarOpen] = useState(false)
  return (
    <div className="date-nav flex flex-1 min-w-0 items-center justify-center">
      <button
        onClick={() => onChange(addDays(selectedDate, -1))}
        className="no-drag w-6 h-6 shrink-0 rounded-md flex items-center justify-center hover:bg-white/10 leading-none"
        aria-label={t('Previous day', '前一天')}
      >
        ‹
      </button>
      <button
        onClick={() => setCalendarOpen((open) => !open)}
        className="no-drag text-sm font-medium px-1 py-0.5 min-w-0 truncate rounded-md hover:bg-white/10"
        style={{ color: 'var(--color-text-muted)' }}
        title={formatDisplayDate(selectedDate, language)}
        aria-label={t('Open calendar', '打开日历选择日期')}
        aria-expanded={calendarOpen}
        id="calendar-trigger"
      >
        {formatDisplayDate(selectedDate, language)}
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
        className="no-drag w-6 h-6 shrink-0 rounded-md flex items-center justify-center hover:bg-white/10 leading-none"
        aria-label={t('Next day', '后一天')}
      >
        ›
      </button>
    </div>
  )
}
