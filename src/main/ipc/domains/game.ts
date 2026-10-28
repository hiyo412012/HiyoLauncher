import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerGameIpc(router: Router): void {
  router.handle('versions:list', S.VersionsListSchema, async () => notImpl())
  router.handle('versions:loaders', S.LoadersSchema, async () => notImpl())
  router.handle('versions:loaderVersions', S.LoaderVersionsSchema, async () => notImpl())
  router.handle('java:detect', S.JavaDetectSchema, async () => notImpl())
  router.handle('java:install', S.JavaInstallSchema, async () => notImpl())
  router.handle('launch:start', S.LaunchStartSchema, async () => notImpl())
  router.handle('launch:stop', S.LaunchStopSchema, async () => notImpl())
  router.handle('launch:status', null, async () => notImpl())
}
