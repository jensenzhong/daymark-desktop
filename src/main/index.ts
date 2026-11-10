import { BrowserWindow, app } from 'electron'
import { createWidgetWindow } from './window'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { markQuitting } from './appState'
import { startReminderScheduler } from './reminders'
import { startDailyRollover } from './dailyRollover'

let mainWindow: BrowserWindow | null = null
let tray: ReturnType<typeof createTray> | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) app.quit()

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

if (hasLock) app.whenReady().then(() => {
  app.setAppUserModelId('com.daymark.app')

  registerIpcHandlers(getWindow)
  startDailyRollover()

  mainWindow = createWidgetWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  tray = createTray(getWindow)
  startReminderScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWidgetWindow()
    } else {
      mainWindow?.show()
    }
  })
}).catch((error: unknown) => {
  console.error('Daymark failed to start:', error)
  app.quit()
})

// The widget has no dock/taskbar presence (skipTaskbar) and is controlled
// entirely via the tray icon: closing the window hides it instead of quitting
// (see window.ts), so 'window-all-closed' is intentionally left unhandled.
app.on('before-quit', () => {
  markQuitting()
})
