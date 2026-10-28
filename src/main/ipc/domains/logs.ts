import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerLogsIpc(router: Router): void {
  router.handle('logs:list', S.LogsListSchema, async () => notImpl())
  router.handle('logs:read', S.LogsReadSchema, async () => notImpl())
  router.handle('logs:analyze', S.LogsAnalyzeSchema, async () => notImpl())
  router.handle('logs:export', S.LogsExportSchema, async () => notImpl())
  router.handle('logs:tail', S.LogsTailSchema, async () => notImpl())
}
