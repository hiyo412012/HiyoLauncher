import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerSkinsIpc(router: Router): void {
  router.handle('skins:get', S.SkinsGetSchema, async () => notImpl())
  router.handle('skins:upload', S.SkinsUploadSchema, async () => notImpl())
  router.handle('skins:setOffline', S.SkinsSetOfflineSchema, async () => notImpl())
}
