import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import { getSkin, setOfflineSkin, uploadSkin } from '../../services/skins'

export function registerSkinsIpc(router: Router): void {
  router.handle('skins:get', S.SkinsGetSchema, async (input: any) => getSkin(input.accountId))
  router.handle('skins:upload', S.SkinsUploadSchema, async (input: any) => {
    await uploadSkin(input)
    return undefined
  })
  router.handle('skins:setOffline', S.SkinsSetOfflineSchema, async (input: any) => {
    await setOfflineSkin(input)
    return undefined
  })
}
