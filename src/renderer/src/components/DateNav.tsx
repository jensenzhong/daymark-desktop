import { addDays, formatDisplayDate, todayKey } from '../lib/date'

interface DateNavProps {
  selectedDate: string
  onChange: (date: string) => void
}

export function DateNav({ selectedDate, onChange }: DateNavProps) {
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
        onClick={() => onChange(todayKey())}
        className="text-sm font-medium px-1 py-0.5 min-w-0 truncate rounded-md hover:bg-white/10"
        style={{ color: 'var(--color-text-muted)' }}
        title={formatDisplayDate(selectedDate)}
      >
        {formatDisplayDate(selectedDate)}
      </button>
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
