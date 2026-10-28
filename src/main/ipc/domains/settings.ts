import { app } from 'electron'
import { createPaths } from '../../services/paths'
import { SettingsService } from '../../services/settings'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'

export function registerSettingsIpc(router: Router): void {
  const userData = app.getPath('userData')
  const paths = createPaths(userData, userData)
  const service = new SettingsService(userData, paths)

  router.handle('settings:get', S.SettingsGetSchema, async () => {
    return await service.get()
  })

  router.handle('settings:update', S.SettingsUpdateSchema, async (input: any) => {
    return await service.update(input.patch ?? {})
  })

  router.handle('settings:reset', S.SettingsResetSchema, async () => {
    return await service.reset()
  })
}
