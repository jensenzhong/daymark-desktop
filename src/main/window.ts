import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import type { DisplayMode, Settings, WindowBounds } from '../shared/types'
import { readSettings, setAutoHeight, setDisplayMode, writeWindowBounds } from './store'
import { isQuitting } from './appState'
import { getIconPath } from './icon'
import { createDrawerController, type DrawerController } from './drawer'

const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 480
const sizingStates = new WeakMap<
  BrowserWindow,
  { autoHeight: boolean; lastRequestedHeight: number | null }
>()
const drawerControllers = new WeakMap<BrowserWindow, DrawerController>()

function clampToVisibleArea(bounds: WindowBounds): WindowBounds {
  const display = screen.getDisplayMatching(bounds)
  const area = display.workArea
  const width = bounds.width
  const height = Math.min(bounds.height, area.height)
  const x = width <= area.width
    ? Math.min(Math.max(bounds.x, area.x), area.x + area.width - width)
    : bounds.x
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
  const savedBounds = settings.displayMode === 'drawer'
    ? settings.drawerBounds ?? settings.windowBounds
    : settings.windowBounds
  const bounds = clampToVisibleArea(savedBounds ?? fallback)
  writeWindowBounds(bounds, settings.displayMode ?? 'fixed')
  return bounds
}

export function createWidgetWindow(): BrowserWindow {
  const bounds = initialBounds()

  const win = new BrowserWindow({
    ...bounds,
    icon: getIconPath(),
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
    lastRequestedHeight: null as number | null
  }
  sizingStates.set(win, sizingState)
  const drawer = createDrawerController(win)
  drawerControllers.set(win, drawer)

  const settings = readSettings()
  win.setAlwaysOnTop(settings.displayMode === 'drawer' || (settings.alwaysOnTop ?? true), 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const persistBounds = (): void => writeWindowBounds(win.getBounds(), readSettings().displayMode ?? 'fixed')
  win.on('moved', persistBounds)
  win.on('will-resize', (_event, nextBounds) => {
    sizingState.lastRequestedHeight = null
    if (sizingState.autoHeight && Math.abs(nextBounds.height - win.getBounds().height) > 2) {
      sizingState.autoHeight = false
      setAutoHeight(false)
      win.webContents.send('window:autoHeight', false)
    }
  })
  win.on('resized', persistBounds)
  win.on('close', (e) => {
    // Tray-managed lifecycle: closing hides instead of quitting unless we're actually quitting.
    if (!isQuitting()) {
      e.preventDefault()
      win.hide()
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    if (readSettings().displayMode === 'drawer') drawer.enable()
  })
  win.on('closed', () => drawer.dispose())

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function setWidgetDisplayMode(win: BrowserWindow | null, mode: DisplayMode): Settings {
  const before = readSettings()
  if (before.displayMode === mode) return before
  const settings = setDisplayMode(mode, win && !win.isDestroyed() ? win.getBounds() : null)
  if (!win || win.isDestroyed()) return settings

  const drawer = drawerControllers.get(win)
  if (mode === 'drawer') {
    if (settings.drawerBounds) win.setBounds(clampToVisibleArea(settings.drawerBounds))
    win.setAlwaysOnTop(true, 'floating')
    drawer?.enable()
  } else {
    drawer?.disable()
    if (settings.windowBounds) win.setBounds(clampToVisibleArea(settings.windowBounds))
    win.setAlwaysOnTop(settings.alwaysOnTop ?? true, 'floating')
    if (!win.isVisible()) win.show()
  }
  return settings
}

export function setWidgetContentHeight(win: BrowserWindow, requestedHeight: number): void {
  const sizingState = sizingStates.get(win)
  if (!sizingState?.autoHeight || !(readSettings().autoHeight ?? true) || !Number.isFinite(requestedHeight)) return

  const bounds = win.getBounds()
  const workArea = screen.getDisplayMatching(bounds).workArea
  const height = Math.min(Math.max(Math.ceil(requestedHeight), 140), workArea.height)
  // Windows can round window dimensions by a pixel at fractional display scales.
  // Do not retry the same target indefinitely when the OS rounds the result.
  if (Math.abs(height - bounds.height) <= 2 || sizingState.lastRequestedHeight === height) return
  sizingState.lastRequestedHeight = height

  // Auto-fit changes only height. Keep the width and position the user chose.
  win.setSize(bounds.width, height)
}

export function setWidgetAutoHeight(win: BrowserWindow | null, enabled: boolean): void {
  if (!win) return
  const sizingState = sizingStates.get(win)
  if (sizingState) {
    sizingState.autoHeight = enabled
    sizingState.lastRequestedHeight = null
  }
}
