import type { Router } from '../router'
import * as S from '../../../shared/schemas'

function notImpl(): never {
  const e: any = new Error('not implemented')
  e.code = 'NOT_IMPLEMENTED'
  throw e
}

export function registerContentIpc(router: Router): void {
  router.handle('modrinth:search', S.ModrinthSearchSchema, async () => notImpl())
  router.handle('modrinth:project', S.ModrinthProjectSchema, async () => notImpl())
  router.handle('modrinth:versions', S.ModrinthVersionsSchema, async () => notImpl())
  router.handle('content:list', S.ContentListSchema, async () => notImpl())
  router.handle('content:install', S.ContentInstallSchema, async () => notImpl())
  router.handle('content:toggle', S.ContentToggleSchema, async () => notImpl())
  router.handle('content:remove', S.ContentRemoveSchema, async () => notImpl())
  router.handle('content:checkUpdates', S.ContentCheckUpdatesSchema, async () => notImpl())
  router.handle('content:update', S.ContentUpdateSchema, async () => notImpl())
  router.handle('modpack:search', S.ModpackSearchSchema, async () => notImpl())
  router.handle('modpack:install', S.ModpackInstallSchema, async () => notImpl())
  router.handle('modpack:checkUpdate', S.ModpackCheckUpdateSchema, async () => notImpl())
  router.handle('modpack:update', S.ModpackUpdateSchema, async () => notImpl())
}
