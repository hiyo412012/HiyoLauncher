import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import * as Modrinth from '../../services/modrinth'
import * as Content from '../../services/content'
import * as Modpack from '../../services/modpack'

export function registerContentIpc(router: Router): void {
  router.handle('modrinth:search', S.ModrinthSearchSchema, async (input: any) => (Modrinth as any).searchProjects(input))
  router.handle('modrinth:project', S.ModrinthProjectSchema, async (input: any) => (Modrinth as any).getProject(input.id))
  router.handle('modrinth:versions', S.ModrinthVersionsSchema, async (input: any) =>
    (Modrinth as any).getProjectVersions(input.projectId, { loader: input.loader, mcVersion: input.mcVersion }),
  )
  router.handle('content:list', S.ContentListSchema, async (input: any) => (Content as any).listContent(input.instanceId))
  router.handle('content:install', S.ContentInstallSchema, async (input: any) => (Content as any).installContent(input))
  router.handle('content:toggle', S.ContentToggleSchema, async (input: any) =>
    (Content as any).toggleContent(input.instanceId, input.path, input.enabled),
  )
  router.handle('content:remove', S.ContentRemoveSchema, async (input: any) =>
    (Content as any).removeContent(input.instanceId, input.path),
  )
  router.handle('content:checkUpdates', S.ContentCheckUpdatesSchema, async (input: any) =>
    (Content as any).checkUpdates(input.instanceId),
  )
  router.handle('content:update', S.ContentUpdateSchema, async (input: any) =>
    (Content as any).updateContent(input.instanceId, input.path, input.versionId),
  )
  router.handle('modpack:search', S.ModpackSearchSchema, async (input: any) =>
    (Modrinth as any).searchProjects({ ...input, projectType: 'modpack' }),
  )
  router.handle('modpack:install', S.ModpackInstallSchema, async (input: any) => {
    const instanceId = await (Modpack as any).installModpack(input)
    return { instanceId }
  })
  router.handle('modpack:checkUpdate', S.ModpackCheckUpdateSchema, async (input: any) =>
    (Modpack as any).checkModpackUpdate(input.instanceId),
  )
  router.handle('modpack:update', S.ModpackUpdateSchema, async (input: any) =>
    (Modpack as any).updateModpack(input.instanceId),
  )
}