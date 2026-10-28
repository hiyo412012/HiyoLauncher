import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import { checkForUpdates, downloadUpdate, installUpdate } from '../../services/updater'
import { setDiscordEnabled } from '../../services/discord'

export function registerMiscIpc(router: Router): void {
  router.handle('misc:discordSet', S.MiscDiscordSetSchema, async (input: any) => {
    await setDiscordEnabled(!!input.enabled)
    return undefined
  })
  router.handle('misc:updaterCheck', S.MiscUpdaterCheckSchema, async () => checkForUpdates())
  router.handle('misc:updaterDownload', S.MiscUpdaterDownloadSchema, async () => {
    await downloadUpdate()
    return undefined
  })
  router.handle('misc:updaterInstall', S.MiscUpdaterInstallSchema, async () => {
    await installUpdate()
    return undefined
  })
}
