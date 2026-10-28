import { BrowserWindow, shell } from 'electron'
import { getServices } from '../../services/context'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import { getGameStatus } from '../../services/game'
import { trashEntry } from '../../services/instance-files'
import {
  createWorldBackup,
  listWorldBackups,
  listWorlds,
  renameWorld,
  restoreWorldBackup,
  removeWorldBackup,
} from '../../services/worlds'
import { EVENTS } from '../../../shared/ipc'
import type { WorldBackupProgress } from '../../../shared/types'

function sendProgress(payload: WorldBackupProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send(EVENTS.worldBackupProgress, payload)
    } catch {}
  }
}

function assertNotRunning(instanceId: string): void {
  if (getGameStatus().some((state) => state.instanceId === instanceId)) {
    const error: any = new Error('Stop the game before changing world files')
    error.code = 'INSTANCE_RUNNING'
    throw error
  }
}

function throttledProgress(
  instanceId: string,
  world: string,
  phase: WorldBackupProgress['phase'],
): (current: number, total?: number) => void {
  let last = 0
  return (current, total = 0) => {
    const now = Date.now()
    if (now - last < 120 && (total === 0 || current < total)) return
    last = now
    sendProgress({ instanceId, world, phase, current, total })
  }
}

export function registerWorldsIpc(router: Router): void {
  const rootOf = (instanceId: string) => getServices().instances.dirOf(instanceId)

  router.handle('worlds:list', S.WorldsListSchema, async (input: any) =>
    listWorlds(rootOf(input.instanceId)),
  )

  router.handle('worlds:rename', S.WorldsRenameSchema, async (input: any) => {
    assertNotRunning(input.instanceId)
    await renameWorld(rootOf(input.instanceId), input.folder, input.name)
  })

  router.handle('worlds:backup', S.WorldsBackupSchema, async (input: any) => {
    assertNotRunning(input.instanceId)
    return createWorldBackup(
      rootOf(input.instanceId),
      input.folder,
      throttledProgress(input.instanceId, input.folder, 'compress'),
    )
  })

  router.handle('worlds:backups', S.WorldsBackupsSchema, async (input: any) =>
    listWorldBackups(rootOf(input.instanceId)),
  )

  router.handle('worlds:restore', S.WorldsRestoreSchema, async (input: any) => {
    assertNotRunning(input.instanceId)
    const world = /\/([^/]+)-\d{8}-\d{6}(?:-\d+)?\.zip$/.exec(input.file.replace(/\\/g, '/'))?.[1]
    await restoreWorldBackup(
      rootOf(input.instanceId),
      input.file,
      throttledProgress(input.instanceId, world ?? '', 'extract'),
    )
  })

  router.handle('worlds:remove', S.WorldsRemoveSchema, async (input: any) => {
    assertNotRunning(input.instanceId)
    const root = rootOf(input.instanceId)
    if (input.backupFirst !== false) {
      await createWorldBackup(
        root,
        input.folder,
        throttledProgress(input.instanceId, input.folder, 'compress'),
      )
    }
    await trashEntry(root, `saves/${input.folder}`, (full) => shell.trashItem(full))
  })

  router.handle('worlds:removeBackup', S.WorldsRemoveBackupSchema, async (input: any) => {
    await removeWorldBackup(rootOf(input.instanceId), input.file, (full) => shell.trashItem(full))
  })
}
