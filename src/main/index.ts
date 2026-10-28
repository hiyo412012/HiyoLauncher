import { app, dialog, BrowserWindow, Menu } from 'electron'
import { initServices } from './services/context'
import { getLogger } from './services/logger'
import { registerIpc } from './ipc'
import { createMainWindow } from './window'
import { initUpdater } from './services/updater'
import { syncDiscord } from './services/discord'

// Must run before any app.getPath('userData') call.
app.setName('HiyoLauncher')
if (process.platform === 'win32') app.setAppUserModelId('org.hiyolauncher.app')
Menu.setApplicationMenu(null)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

process.on('uncaughtException', (err) => {
  try {
    getLogger().error('uncaughtException', { message: err?.message, stack: err?.stack })
  } catch {}
  dialog.showErrorBox('HiyoLauncher', String(err?.message ?? err))
})

process.on('unhandledRejection', (reason: any) => {
  try {
    getLogger().error('unhandledRejection', { reason: String(reason?.message ?? reason) })
  } catch {}
})

app.whenReady().then(async () => {
  await initServices()
  getLogger().info('app ready', { version: app.getVersion() })
  registerIpc()
  mainWindow = createMainWindow()
  setTimeout(() => {
    void initUpdater()
    void syncDiscord()
  }, 1500)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
