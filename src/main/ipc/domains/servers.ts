import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerServersIpc(router: Router): void {
  router.handle('servers:list', S.ServersListSchema, async () => notImpl())
  router.handle('servers:add', S.ServersAddSchema, async () => notImpl())
  router.handle('servers:remove', S.ServersRemoveSchema, async () => notImpl())
  router.handle('servers:ping', S.ServersPingSchema, async () => notImpl())
  router.handle('servers:join', S.ServersJoinSchema, async () => notImpl())
}
