import { app, BrowserWindow } from 'electron'
import type { UpdaterStatus } from '../../shared/types'
import { getLogger } from './logger'

let status: UpdaterStatus = { state: 'idle' }
let initialized = false
let autoUpdaterRef: any = null

function emit(next: UpdaterStatus): void {
  status = next
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('updater:status', next)
    } catch {}
  }
}

export function getUpdaterStatus(): UpdaterStatus {
  return status
}

async function loadUpdater(): Promise<any> {
  if (autoUpdaterRef) return autoUpdaterRef
  const mod: any = await import('electron-updater')
  autoUpdaterRef = mod.autoUpdater ?? mod.default?.autoUpdater
  return autoUpdaterRef
}

export async function initUpdater(): Promise<void> {
  if (initialized) return
  initialized = true
  if (!app.isPackaged) {
    emit({ state: 'not-available' })
    return
  }
  try {
    const autoUpdater = await loadUpdater()
    if (!autoUpdater) return
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }))
    autoUpdater.on('update-available', (info: any) => {
      emit({ state: 'available', version: info?.version })
    })
    autoUpdater.on('update-not-available', () => emit({ state: 'not-available' }))
    autoUpdater.on('download-progress', (progress: any) => {
      emit({ state: 'downloading', progress: Math.round(progress?.percent ?? 0) })
    })
    autoUpdater.on('update-downloaded', (info: any) => {
      emit({ state: 'downloaded', version: info?.version })
    })
    autoUpdater.on('error', (error: any) => {
      getLogger().warn('updater error', { message: error?.message })
      emit({ state: 'error', error: String(error?.message ?? error) })
    })

    setTimeout(() => {
      checkForUpdates().catch(() => {})
    }, 10_000)
  } catch (e: any) {
    getLogger().warn('updater init failed', { message: e?.message })
    emit({ state: 'error', error: 'Updater is unavailable in this build' })
  }
}

export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    emit({ state: 'not-available' })
    return status
  }
  try {
    const autoUpdater = await loadUpdater()
    if (!autoUpdater) {
      emit({ state: 'error', error: 'Updater is unavailable' })
      return status
    }
    emit({ state: 'checking' })
    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      emit({ state: 'not-available' })
    } else if (status.state === 'checking') {
      emit({ state: 'not-available' })
    }
    return status
  } catch (e: any) {
    emit({ state: 'error', error: String(e?.message ?? e) })
    return status
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    const autoUpdater = await loadUpdater()
    if (!autoUpdater) return
    emit({ state: 'downloading', progress: 0 })
    await autoUpdater.downloadUpdate()
  } catch (e: any) {
    emit({ state: 'error', error: String(e?.message ?? e) })
  }
}

export async function installUpdate(): Promise<void> {
  try {
    const autoUpdater = await loadUpdater()
    if (!autoUpdater) return
    autoUpdater.quitAndInstall()
  } catch (e: any) {
    emit({ state: 'error', error: String(e?.message ?? e) })
  }
}
