import { getServices } from '../../services/context'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'

export function registerInstancesIpc(router: Router): void {
  const service = getServices().instances

  router.handle('instances:list', null, async () => service.list())
  router.handle('instances:create', S.InstanceCreateSchema, async (input: any) => service.create(input))
  router.handle('instances:update', S.InstanceUpdateSchema, async (input: any) => service.update(input.id, input.patch))
  router.handle('instances:remove', S.InstanceRemoveSchema, async (input: any) => service.remove(input.id, input.deleteFiles ?? false))
  router.handle('instances:clone', S.InstanceCloneSchema, async (input: any) => service.clone(input.id, input.newName))
  router.handle('instances:repair', S.InstanceRepairSchema, async (input: any) => service.repair(input.id))
  router.handle('instances:openFolder', S.InstanceOpenFolderSchema, async (input: any) => {
    const { shell } = await import('electron')
    shell.openPath(service.dirOf(input.id))
    return undefined
  })
  router.handle('instances:setIcon', S.InstanceSetIconSchema, async (input: any) => service.setIcon(input.id, input.dataUrl))
}
