import { ipcMain } from 'electron'
import { z } from 'zod'
import type { ApiError, ApiResult } from '../../shared/types'

export interface Router {
  handle(channel: string, schema: z.ZodTypeAny | null, handler: (input: any) => Promise<any> | any): void
}

function toApiError(e: any): ApiError {
  const code = e?.code && typeof e.code === 'string' ? e.code : 'UNKNOWN'
  const message = e?.message ? String(e.message) : String(e)
  return { code, message }
}

export function createRouter(): Router {
  return {
    handle(channel, schema, handler) {
      ipcMain.handle(channel, async (_event, payload) => {
        try {
          let input = payload
          if (schema) {
            const parsed = schema.safeParse(payload ?? {})
            if (!parsed.success) {
              return { ok: false, error: { code: 'VALIDATION', message: parsed.error.message } } as ApiResult<any>
            }
            input = parsed.data
          }
          const data = await handler(input)
          return { ok: true, data } as ApiResult<any>
        } catch (e: any) {
          return { ok: false, error: toApiError(e) } as ApiResult<any>
        }
      })
    },
  }
}
