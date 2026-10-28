import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import { addServer, listServers, pingServer, removeServer } from '../../services/servers'
import { listAccounts } from '../../services/auth'
import { launchInstance } from '../../services/game'

export function registerServersIpc(router: Router): void {
  router.handle('servers:list', S.ServersListSchema, async () => listServers())
  router.handle('servers:add', S.ServersAddSchema, async (input: any) => addServer(input))
  router.handle('servers:remove', S.ServersRemoveSchema, async (input: any) => {
    await removeServer(input.index)
    return undefined
  })
  router.handle('servers:ping', S.ServersPingSchema, async (input: any) => pingServer(input))
  router.handle('servers:join', S.ServersJoinSchema, async (input: any) => {
    const servers = await listServers()
    const server = servers[input.index]
    if (!server) {
      const e: any = new Error('Server not found')
      e.code = 'NOT_FOUND'
      throw e
    }
    const accounts = await listAccounts()
    const accountId = input.accountId ?? accounts[0]?.id
    const [host, portText] = server.ip.split(':')
    const port = portText ? Number(portText) : undefined
    await launchInstance({ instanceId: input.instanceId, accountId, server: { host, port } })
    return undefined
  })
}
