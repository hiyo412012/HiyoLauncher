import { app, dialog, shell } from 'electron'
import { z } from 'zod'
import { createPaths } from '../../services/paths'
import { SettingsService } from '../../services/settings'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'

export function registerAppIpc(router: Router): void {
  const userData = app.getPath('userData')
  const paths = createPaths(userData, userData)
  const settings = new SettingsService(userData, paths)

  router.handle('app:info', null, async () => {
    const s = await settings.get()
    paths.setGameRoot(s.gameRoot)
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      userData,
      isPackaged: app.isPackaged,
    }
  })

  router.handle('app:openExternal', S.AppOpenExternalSchema, async (input: any) => {
    await shell.openExternal(input.url)
    return undefined
  })

  router.handle('app:pickDirectory', S.AppPickDirectorySchema, async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths.length) return null
    return res.filePaths[0]
  })

  router.handle('app:pickFile', S.AppPickFileSchema, async (input: any) => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: input?.filters,
    })
    if (res.canceled || !res.filePaths.length) return null
    return res.filePaths[0]
  })

  router.handle('app:revealPath', S.AppRevealPathSchema, async (input: any) => {
    shell.showItemInFolder(input.path)
    return undefined
  })

  router.handle('app:versions', null, async () => {
    return [app.getVersion()]
  })
}
