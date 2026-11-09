interface TitleBarProps {
  onOpenSettings: () => void
  pinned: boolean
  onTogglePin: () => void
}

export function TitleBar({ onOpenSettings, pinned, onTogglePin }: TitleBarProps) {
  return (
    <div className="drag-region flex items-center justify-between px-4 py-3 shrink-0">
      <span className="font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
        Daymark
      </span>
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={onTogglePin}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          style={{ color: pinned ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          aria-label={pinned ? 'Unpin widget from top' : 'Keep widget on top'}
          aria-pressed={pinned}
          title={pinned ? 'Unpin widget from top' : 'Keep widget on top'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${pinned ? '' : 'rotate-45'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 3H8l1.5 6L6 12v1h5v8l1-1v-7h6v-1l-3.5-3L16 3Z" />
          </svg>
        </button>
        <button
          onClick={onOpenSettings}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors leading-none"
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
        <button
          onClick={() => window.api.window.hide()}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors leading-none"
          aria-label="Hide widget"
          title="Hide widget"
        >
          –
        </button>
      </div>
    </div>
  )
}
