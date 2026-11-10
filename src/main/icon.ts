import { app } from 'electron'
import { join } from 'path'

export function getIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'build', 'icon.png')
    : join(__dirname, '../../build/icon.png')
}
