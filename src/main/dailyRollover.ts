import { BrowserWindow } from 'electron'
import { rolloverIncompleteTodos } from './store'

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

let lastProcessedDate = ''

function processNewDay(): void {
  const today = localDateKey(new Date())
  if (today === lastProcessedDate) return

  rolloverIncompleteTodos(today)
  lastProcessedDate = today

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) window.webContents.send('todos:changed')
  })
}

export function startDailyRollover(): void {
  processNewDay()
  setInterval(processNewDay, 30_000)
}
