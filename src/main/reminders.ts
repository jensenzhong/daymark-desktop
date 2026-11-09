import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import type { Todo } from '../shared/types'
import { readTodos } from './store'

let reminderWindow: BrowserWindow | null = null
let activeReminderId: string | null = null
let scheduler: ReturnType<typeof setInterval> | null = null

function showReminder(todo: Todo): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  const windowWidth = Math.min(480, width - 32)
  const windowHeight = Math.min(300, height - 32)

  activeReminderId = todo.id
  reminderWindow = new BrowserWindow({
    x: Math.round(x + (width - windowWidth) / 2),
    y: Math.round(y + (height - windowHeight) / 2),
    width: windowWidth,
    height: windowHeight,
    minWidth: Math.min(320, windowWidth),
    minHeight: Math.min(220, windowHeight),
    title: 'Daymark Reminder',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  reminderWindow.setAlwaysOnTop(true, 'screen-saver')
  reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  reminderWindow.once('ready-to-show', () => {
    reminderWindow?.show()
    reminderWindow?.focus()
  })
  reminderWindow.on('closed', () => {
    reminderWindow = null
    activeReminderId = null
  })

  const query = {
    reminder: '1',
    id: todo.id,
    text: todo.text,
    at: String(todo.reminderAt ?? Date.now())
  }
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    const url = new URL(rendererUrl)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    void reminderWindow.loadURL(url.toString())
  } else {
    void reminderWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}

function showNextDueReminder(): void {
  if (reminderWindow && !reminderWindow.isDestroyed()) return

  const now = Date.now()
  const due = readTodos()
    .filter((todo) => !todo.done && todo.reminderAt != null && todo.reminderAt <= now)
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0))[0]

  if (due) showReminder(due)
}

export function startReminderScheduler(): void {
  if (scheduler) return
  showNextDueReminder()
  scheduler = setInterval(showNextDueReminder, 1000)
}

export function dismissActiveReminder(id: string): void {
  if (activeReminderId !== id) return
  const currentWindow = reminderWindow
  reminderWindow = null
  activeReminderId = null
  currentWindow?.destroy()
  showNextDueReminder()
}
