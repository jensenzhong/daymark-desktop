import { BrowserWindow, Menu, Tray, app, nativeImage } from 'electron'
import { markQuitting } from './appState'
import { getIconPath } from './icon'

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const baseIcon = nativeImage.createFromPath(getIconPath())
  const trayIcon = baseIcon.isEmpty() ? baseIcon : baseIcon.resize({ width: 22, height: 22 })
  const tray = new Tray(trayIcon)
  tray.setToolTip('Daymark')

  const rebuildMenu = (): void => {
    const win = getWindow()
    const visible = win?.isVisible() ?? false
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? 'Hide Widget' : 'Show Widget',
          click: () => {
            if (!win) return
            if (visible) win.hide()
            else win.show()
            rebuildMenu()
          }
        },
        { type: 'separator' },
        {
          label: 'Quit Daymark',
          click: () => {
            markQuitting()
            app.quit()
          }
        }
      ])
    )
  }

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
