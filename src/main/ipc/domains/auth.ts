import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerAuthIpc(router: Router): void {
  router.handle('accounts:list', null, async () => notImpl())
  router.handle('accounts:addOffline', S.AccountAddOfflineSchema, async () => notImpl())
  router.handle('accounts:remove', S.AccountRemoveSchema, async () => notImpl())
  router.handle('accounts:msLogin', null, async () => notImpl())
  router.handle('accounts:cancelMsLogin', null, async () => notImpl())
  router.handle('accounts:refresh', S.AccountRefreshSchema, async () => notImpl())
}
