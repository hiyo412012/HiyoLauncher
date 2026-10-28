import { dialog, shell } from 'electron'
import { getServices } from '../../services/context'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import {
  importFiles,
  listDirectory,
  renameEntry,
  resolveInstancePath,
  trashEntry,
} from '../../services/instance-files'

export function registerFilesIpc(router: Router): void {
  const rootOf = (instanceId: string) => getServices().instances.dirOf(instanceId)

  router.handle('files:list', S.FilesListSchema, async (input: any) =>
    listDirectory(rootOf(input.instanceId), input.path),
  )

  router.handle('files:import', S.FilesImportSchema, async (input: any) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Add files to instance',
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return importFiles(rootOf(input.instanceId), input.path ?? '', result.filePaths)
  })

  router.handle('files:rename', S.FilesRenameSchema, async (input: any) =>
    renameEntry(rootOf(input.instanceId), input.path, input.newName),
  )

  router.handle('files:trash', S.FilesTrashSchema, async (input: any) => {
    await trashEntry(rootOf(input.instanceId), input.path, (full) => shell.trashItem(full))
  })

  router.handle('files:open', S.FilesOpenSchema, async (input: any) => {
    const full = resolveInstancePath(rootOf(input.instanceId), input.path)
    const error = await shell.openPath(full)
    if (error) throw new Error(error)
  })

  router.handle('files:reveal', S.FilesRevealSchema, async (input: any) => {
    shell.showItemInFolder(resolveInstancePath(rootOf(input.instanceId), input.path))
  })
}
