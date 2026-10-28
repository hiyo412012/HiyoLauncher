import { app } from 'electron'
import { createPaths } from '../../services/paths'
import { SettingsService } from '../../services/settings'
import { InstanceService } from '../../services/instances'
import { VersionsService } from '../../services/versions'
import { JavaService } from '../../services/java'
import * as game from '../../services/game'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'

export function registerGameIpc(router: Router): void {
  const userData = app.getPath('userData')
  const paths = createPaths(userData, userData)
  const settings = new SettingsService(userData, paths)
  const instances = new InstanceService(paths)
  const versions = new VersionsService(paths)
  const java = new JavaService(paths)

  // ensure paths gameRoot from settings
  const initPaths = async () => {
    const s = await settings.get()
    paths.setGameRoot(s.gameRoot)
    await paths.ensureDirs()
    return paths
  }

  router.handle('versions:list', S.VersionsListSchema, async (input: any) => {
    await initPaths()
    return await versions.list(input?.force ?? false)
  })

  router.handle('versions:loaders', S.LoadersSchema, async (input: any) => {
    // delegates to loaders service if present
    try {
      const mod: any = await import('@main/services/loaders')
      if (mod?.getLoaderVersions) return await mod.getLoaderVersions(input.type, input.mcVersion)
    } catch {}
    return []
  })

  router.handle('versions:loaderVersions', S.LoaderVersionsSchema, async (input: any) => {
    try {
      const mod: any = await import('@main/services/loaders')
      if (mod?.getLoaderVersions) return await mod.getLoaderVersions(input.type, input.mcVersion)
    } catch {}
    return []
  })

  router.handle('java:detect', S.JavaDetectSchema, async () => {
    await initPaths()
    return await java.detect()
  })

  router.handle('java:install', S.JavaInstallSchema, async (input: any) => {
    await initPaths()
    return await java.install(input.major, (p: any) => {})
  })

  router.handle('launch:start', S.LaunchStartSchema, async (input: any) => {
    await initPaths()
    const res = await game.launchInstance(
      { instanceId: input.instanceId, accountId: input.accountId, server: input.server, quickPlay: input.quickPlay },
      { paths },
    )
    return res
  })

  router.handle('launch:stop', S.LaunchStopSchema, async (input: any) => {
    game.stopGame(input.instanceId)
    return undefined
  })

  router.handle('launch:status', null, async () => {
    return game.getGameStatus()
  })
}
