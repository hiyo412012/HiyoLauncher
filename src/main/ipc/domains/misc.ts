import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerMiscIpc(router: Router): void {
  router.handle('misc:discordSet', S.MiscDiscordSetSchema, async () => notImpl())
  router.handle('misc:updaterCheck', S.MiscUpdaterCheckSchema, async () => notImpl())
  router.handle('misc:updaterDownload', S.MiscUpdaterDownloadSchema, async () => notImpl())
  router.handle('misc:updaterInstall', S.MiscUpdaterInstallSchema, async () => notImpl())
}
