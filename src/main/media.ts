import { protocol } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getServices } from './services/context'
import { assertRealInside } from './services/instance-files'
import { screenshotPath } from './services/screenshots'

export const MEDIA_SCHEME = 'hiyo-shot'

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}

/**
 * Serves screenshots from an instance without exposing arbitrary filesystem paths.
 * URL shape: hiyo-shot://instance/<instanceId>/<filename>
 */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'instance') return notFound()
      const segments = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
      if (segments.length !== 2) return notFound()
      const [instanceId, file] = segments
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(instanceId)) return notFound()
      const root = getServices().instances.dirOf(instanceId)
      const full = screenshotPath(root, file)
      await assertRealInside(root, full)
      const stat = await fsp.stat(full)
      if (!stat.isFile()) return notFound()
      const extension = path.extname(file).toLowerCase()
      const contentType =
        extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
      const stream = Readable.toWeb(fs.createReadStream(full)) as unknown as ReadableStream
      return new Response(stream, {
        headers: {
          'content-type': contentType,
          'content-length': String(stat.size),
          'cache-control': 'no-store',
        },
      })
    } catch {
      return notFound()
    }
  })
}
