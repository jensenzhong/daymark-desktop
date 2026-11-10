import { BrowserWindow, Menu, Tray, app, nativeImage } from 'electron'
import { markQuitting } from './appState'
import { getIconPath } from './icon'
import { readSettings } from './store'

let refreshMenu = (): void => {}
export function refreshTrayMenu(): void { refreshMenu() }

function createTrayIcon(image: Electron.NativeImage): Electron.NativeImage {
  if (image.isEmpty()) return image

  const { width, height } = image.getSize()
  const bitmap = image.toBitmap()
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  // The source logo has transparent margins. Measure its visible pixels so
  // the small tray icon uses the available space without changing the artwork.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bitmap[(y * width + x) * 4 + 3] <= 64) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < left || bottom < top) return image.resize({ width: 22, height: 22 })

  const side = Math.min(width, height, Math.ceil(Math.max(right - left + 1, bottom - top + 1) * 1.08))
  const x = Math.max(0, Math.min(width - side, Math.round((left + right + 1 - side) / 2)))
  const y = Math.max(0, Math.min(height - side, Math.round((top + bottom + 1 - side) / 2)))
  return image.crop({ x, y, width: side, height: side }).resize({ width: 22, height: 22, quality: 'best' })
}

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const baseIcon = nativeImage.createFromPath(getIconPath())
  const trayIcon = createTrayIcon(baseIcon)
  const tray = new Tray(trayIcon)
  tray.setToolTip('Daymark')

  const rebuildMenu = (): void => {
    const win = getWindow()
    const visible = win?.isVisible() ?? false
    const zh = readSettings().language === 'zh'
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? (zh ? '隐藏窗口' : 'Hide Widget') : (zh ? '显示窗口' : 'Show Widget'),
          click: () => {
            if (!win) return
            if (visible) win.hide()
            else win.show()
            rebuildMenu()
          }
        },
        { type: 'separator' },
        {
          label: zh ? '退出 Daymark' : 'Quit Daymark',
          click: () => {
            markQuitting()
            app.quit()
          }
        }
      ])
    )
  }

  refreshMenu = rebuildMenu
  rebuildMenu()
  tray.on('click', () => {
    const win = getWindow()
    if (!win) return
    if (win.isVisible()) win.hide()
    else win.show()
    rebuildMenu()
  })

  return tray
}
