import { useLanguage } from '../lib/language'

interface ReminderDialogProps {
  id: string
  text: string
  reminderAt: number
}

export function ReminderDialog({ id, text, reminderAt }: ReminderDialogProps) {
  const { locale, t } = useLanguage()
  const dateLabel = Number.isFinite(reminderAt)
    ? new Date(reminderAt).toLocaleString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : t('Scheduled reminder', '定时提醒')

  return (
    <main className="h-full w-full flex items-center justify-center p-5">
      <section
        className="w-full max-w-md rounded-3xl p-7 shadow-2xl"
        style={{
          color: '#f8fafc',
          background: 'rgba(15, 23, 42, 0.97)',
          boxShadow: '0 24px 72px rgba(0, 0, 0, 0.48)'
        }}
        role="alertdialog"
        aria-labelledby="reminder-heading"
        aria-describedby="reminder-task"
      >
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
            style={{ color: '#bfdbfe', background: 'rgba(96, 165, 250, 0.18)' }}
            aria-hidden="true"
          >
            ◷
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: '#93c5fd' }}>
              {t('Daymark reminder', 'Daymark 提醒')}
            </p>
            <h1 id="reminder-heading" className="mt-1 text-xl font-semibold tracking-tight">
              {t('It’s time', '时间到了')}
            </h1>
          </div>
        </div>

        <p id="reminder-task" className="whitespace-pre-wrap text-lg leading-relaxed [overflow-wrap:anywhere]">
          {text}
        </p>
        <p className="mt-3 text-sm" style={{ color: '#94a3b8' }}>
          {dateLabel}
        </p>

        <button
          autoFocus
          onClick={() => window.api.window.acknowledgeReminder(id)}
          className="mt-7 w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 [--tw-ring-offset-color:#0f172a]"
          style={{ background: '#93c5fd' }}
        >
          {t('Confirm', '知道了')}
        </button>
      </section>
    </main>
  )
}
