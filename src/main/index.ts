import { app, dialog, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPaths } from './services/paths'
import { SettingsService } from './services/settings'
import { createLogger } from './services/logger'
import { registerIpc } from './ipc'
import { createMainWindow } from './window'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: any = null

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

process.on('uncaughtException', (err) => {
  try {
    const userData = app.getPath('userData')
    const logger = createLogger(path.join(userData, 'logs', 'main.log'))
    logger.error('uncaughtException', { message: err?.message, stack: err?.stack })
  } catch {}
  dialog.showErrorBox('HiyoLauncher', String(err?.message ?? err))
})

process.on('unhandledRejection', (reason: any) => {
  try {
    const userData = app.getPath('userData')
    const logger = createLogger(path.join(userData, 'logs', 'main.log'))
    logger.error('unhandledRejection', { reason: String(reason?.message ?? reason) })
  } catch {}
})

app.whenReady().then(async () => {
  const userData = app.getPath('userData')
  const paths = createPaths(userData, path.join(userData, 'minecraft'))
  const logger = createLogger(path.join(userData, 'logs', 'main.log'))
  logger.info('app ready', { version: app.getVersion() })
  const settings = new SettingsService(userData, paths)
  await settings.get()
  await paths.ensureDirs()
  registerIpc()
  mainWindow = createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
