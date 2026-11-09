import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import type { WindowBounds } from '../shared/types'
import { readSettings, setAutoHeight, writeWindowBounds } from './store'
import { isQuitting } from './appState'

const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 480
const sizingStates = new WeakMap<
  BrowserWindow,
  { autoHeight: boolean; lastHeight: number; programmaticHeight: number | null }
>()

function clampToVisibleArea(bounds: WindowBounds): WindowBounds {
  const display = screen.getDisplayMatching(bounds)
  const area = display.workArea
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - height)
  return { x, y, width, height }
}

function initialBounds(): WindowBounds {
  const settings = readSettings()
  const primary = screen.getPrimaryDisplay().workArea
  const fallback: WindowBounds = {
    x: primary.x + primary.width - DEFAULT_WIDTH - 24,
    y: primary.y + 24,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  }
  return clampToVisibleArea(settings.windowBounds ?? fallback)
}

export function createWidgetWindow(): BrowserWindow {
  const bounds = initialBounds()

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 180,
    minHeight: 140,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  const sizingState = {
    autoHeight: readSettings().autoHeight ?? true,
    lastHeight: bounds.height,
    programmaticHeight: null as number | null
  }
  sizingStates.set(win, sizingState)

  win.setAlwaysOnTop(readSettings().alwaysOnTop ?? true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const persistBounds = (): void => writeWindowBounds(win.getBounds())
  win.on('moved', persistBounds)
  win.on('resized', () => {
    const height = win.getBounds().height
    if (
      sizingState.autoHeight &&
      height !== sizingState.lastHeight &&
      height !== sizingState.programmaticHeight
    ) {
      sizingState.autoHeight = false
      sizingState.programmaticHeight = null
      setAutoHeight(false)
      win.webContents.send('window:autoHeight', false)
    } else if (height === sizingState.programmaticHeight) {
      sizingState.programmaticHeight = null
    }
    sizingState.lastHeight = height
    persistBounds()
  })
  win.on('close', (e) => {
    // Tray-managed lifecycle: closing hides instead of quitting unless we're actually quitting.
    if (!isQuitting()) {
      e.preventDefault()
      win.hide()
    }
  })

  win.once('ready-to-show', () => win.show())

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function setWidgetContentHeight(win: BrowserWindow, requestedHeight: number): void {
  const sizingState = sizingStates.get(win)
  if (!sizingState?.autoHeight || !(readSettings().autoHeight ?? true) || !Number.isFinite(requestedHeight)) return

  const bounds = win.getBounds()
  const workArea = screen.getDisplayMatching(bounds).workArea
  const height = Math.min(Math.max(Math.ceil(requestedHeight), 140), workArea.height)
  if (height === bounds.height) return

  const y = Math.min(bounds.y, workArea.y + workArea.height - height)
  sizingState.programmaticHeight = height
  win.setBounds({ ...bounds, y, height })
}

export function setWidgetAutoHeight(win: BrowserWindow | null, enabled: boolean): void {
  if (!win) return
  const sizingState = sizingStates.get(win)
  if (sizingState) sizingState.autoHeight = enabled
}
