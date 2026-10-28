import { BrowserWindow } from 'electron'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import { analyzeLogFile, exportLog, listLogs, readLog, tailLog } from '../../services/crash'

const activeTails = new Map<string, () => void>()

export function registerLogsIpc(router: Router): void {
  router.handle('logs:list', S.LogsListSchema, async (input: any) => listLogs(input?.instanceId))
  router.handle('logs:read', S.LogsReadSchema, async (input: any) => readLog(input.path, input.lines ?? 500))
  router.handle('logs:analyze', S.LogsAnalyzeSchema, async (input: any) => analyzeLogFile(input.path))
  router.handle('logs:export', S.LogsExportSchema, async (input: any) => exportLog(input.path))
  router.handle('logs:tail', S.LogsTailSchema, async (input: any) => {
    const instanceId = input.instanceId as string
    if (activeTails.has(instanceId)) return undefined
    const stop = await tailLog(instanceId, (chunk) => {
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          win.webContents.send('logs:tail:data', { instanceId, chunk })
        } catch {}
      }
    })
    activeTails.set(instanceId, stop)
    return undefined
  })
}
