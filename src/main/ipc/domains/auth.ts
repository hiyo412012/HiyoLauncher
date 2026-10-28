import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import {
  addOfflineAccount,
  cancelMsLogin,
  listAccounts,
  refreshAccount,
  removeAccount,
  startMicrosoftLogin,
} from '../../services/auth'

export function registerAuthIpc(router: Router): void {
  router.handle('accounts:list', null, async () => listAccounts())
  router.handle('accounts:addOffline', S.AccountAddOfflineSchema, async (input: any) =>
    addOfflineAccount(input.name),
  )
  router.handle('accounts:remove', S.AccountRemoveSchema, async (input: any) => {
    await removeAccount(input.id)
    return undefined
  })
  router.handle('accounts:msLogin', null, async () => startMicrosoftLogin())
  router.handle('accounts:cancelMsLogin', null, async () => {
    cancelMsLogin()
    return undefined
  })
  router.handle('accounts:refresh', S.AccountRefreshSchema, async (input: any) =>
    refreshAccount(input.id),
  )
}
