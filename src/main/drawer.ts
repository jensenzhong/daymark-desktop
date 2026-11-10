import { BrowserWindow, screen } from 'electron'

const EDGE_HEIGHT = 7
const HANDLE_WIDTH = 88
const EDGE_MARGIN = 10
const WINDOW_MARGIN = 2
const LEAVE_DELAY = 50
const ANIMATION_MS = 100
const POLL_INTERVAL = 50
const OPEN_GRACE = 120

export interface DrawerController {
  enable: () => void
  disable: () => void
  dispose: () => void
}

export function createDrawerController(win: BrowserWindow): DrawerController {
  let enabled = false
  let outsideSince = 0
  let graceUntil = 0
  let handle: BrowserWindow | null = null
  let handleReady = false
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  const motion = (direction: 'open' | 'close'): void => {
    if (!win.isDestroyed()) win.webContents.send('window:drawerMotion', direction)
  }

  const edgeBounds = (): Electron.Rectangle => {
    const widget = win.getBounds()
    const display = screen.getDisplayMatching(widget)
    const edge = display.bounds
    const width = Math.min(HANDLE_WIDTH, widget.width, edge.width)
    const center = widget.x + widget.width / 2
    const x = Math.round(Math.max(edge.x, Math.min(center - width / 2, edge.x + edge.width - width)))
    return { x, y: edge.y, width, height: EDGE_HEIGHT }
  }

  const showHandle = (): void => {
    if (!enabled || win.isDestroyed() || win.isVisible()) return
    const bounds = edgeBounds()
    if (!handle || handle.isDestroyed()) {
      handleReady = false
      handle = new BrowserWindow({
        ...bounds,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        show: false,
        webPreferences: { contextIsolation: true, sandbox: true }
      })
      handle.setAlwaysOnTop(true, 'floating')
      handle.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      handle.setIgnoreMouseEvents(true)
      const currentHandle = handle
      const html = '<!doctype html><style>html,body{margin:0;background:transparent}div{height:5px;border-radius:0 0 6px 6px;background:rgba(87,108,137,.65);box-shadow:0 1px 3px rgba(0,0,0,.2)}</style><div></div>'
      currentHandle.once('ready-to-show', () => {
        handleReady = true
        if (enabled && !win.isDestroyed() && !win.isVisible() && !currentHandle.isDestroyed()) currentHandle.showInactive()
      })
      void currentHandle.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    } else {
      const current = handle.getBounds()
      if (Math.abs(current.x - bounds.x) > 2 || Math.abs(current.y - bounds.y) > 2 || Math.abs(current.width - bounds.width) > 2) handle.setBounds(bounds)
      if (handleReady && !handle.isVisible()) handle.showInactive()
    }
  }

  const dock = (): void => {
    const bounds = win.getBounds()
    const area = screen.getDisplayMatching(bounds).workArea
    const x = Math.max(area.x, Math.min(bounds.x, area.x + Math.max(0, area.width - bounds.width)))
    win.setPosition(Math.round(x), area.y)
  }

  const isAtHandle = (point: Electron.Point): boolean => {
    const edge = edgeBounds()
    return point.x >= edge.x - EDGE_MARGIN && point.x < edge.x + edge.width + EDGE_MARGIN &&
      point.y >= edge.y && point.y < edge.y + EDGE_HEIGHT + EDGE_MARGIN
  }

  const isNearWidget = (point: Electron.Point): boolean => {
    const bounds = win.getBounds()
    return point.x >= bounds.x - WINDOW_MARGIN && point.x < bounds.x + bounds.width + WINDOW_MARGIN &&
      point.y >= bounds.y - WINDOW_MARGIN && point.y < bounds.y + bounds.height + WINDOW_MARGIN
  }

  const cancelClose = (): void => {
    if (!closeTimer) return
    clearTimeout(closeTimer)
    closeTimer = null
    motion('open')
  }

  const onShow = (): void => {
    if (!enabled) return
    if (handle && !handle.isDestroyed()) handle.hide()
    outsideSince = 0
    graceUntil = Date.now() + OPEN_GRACE
    motion('open')
  }
  win.on('show', onShow)

  const poll = (): void => {
    if (!enabled || win.isDestroyed()) return
    const point = screen.getCursorScreenPoint()
    if (!win.isVisible()) {
      showHandle()
      if (isAtHandle(point)) {
        handle?.hide()
        dock()
        win.showInactive()
        motion('open')
        outsideSince = 0
        graceUntil = Date.now() + OPEN_GRACE
      }
      return
    }

    if (handle && !handle.isDestroyed() && handle.isVisible()) handle.hide()
    if (isNearWidget(point) || isAtHandle(point)) {
      outsideSince = 0
      cancelClose()
      return
    }
    if (Date.now() < graceUntil || closeTimer) return
    if (!outsideSince) outsideSince = Date.now()
    if (Date.now() - outsideSince < LEAVE_DELAY) return

    motion('close')
    closeTimer = setTimeout(() => {
      closeTimer = null
      if (!enabled || win.isDestroyed()) return
      const current = screen.getCursorScreenPoint()
      if (isNearWidget(current) || isAtHandle(current)) {
        outsideSince = 0
        motion('open')
        return
      }
      win.hide()
      outsideSince = 0
      showHandle()
    }, ANIMATION_MS)
  }

  return {
    enable: () => {
      enabled = true
      if (!timer) timer = setInterval(poll, POLL_INTERVAL)
      outsideSince = 0
      graceUntil = Date.now() + OPEN_GRACE
      dock()
      if (!win.isVisible()) win.showInactive()
      motion('open')
    },
    disable: () => {
      enabled = false
      if (timer) clearInterval(timer)
      timer = null
      outsideSince = 0
      cancelClose()
      if (handle && !handle.isDestroyed()) handle.hide()
      motion('open')
    },
    dispose: () => {
      enabled = false
      if (timer) clearInterval(timer)
      timer = null
      if (closeTimer) clearTimeout(closeTimer)
      win.removeListener('show', onShow)
      if (handle && !handle.isDestroyed()) handle.destroy()
      handle = null
    }
  }
}
