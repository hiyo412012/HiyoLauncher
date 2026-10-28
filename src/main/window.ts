import { BrowserWindow, shell, app } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createMainWindow(): BrowserWindow {
  const iconCandidates = [
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(app.getAppPath(), '..', '..', 'build', 'icon.png'),
    path.join(process.cwd(), 'build', 'icon.png'),
    path.join(process.resourcesPath ?? '', 'icon.png'),
  ]
  const iconPath = iconCandidates.find((candidate) => candidate && existsSync(candidate))
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 1024,
    minHeight: 680,
    title: 'HiyoLauncher',
    backgroundColor: '#071a22',
    show: false,
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (/^https?:/i.test(url)) shell.openExternal(url)
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}
