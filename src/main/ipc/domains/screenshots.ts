import { ClipboardItem, clipboard, nativeImage, shell } from 'electron'
import { getServices } from '../../services/context'
import type { Router } from '../router'
import * as S from '../../../shared/schemas'
import { listScreenshots, screenshotPath } from '../../services/screenshots'

export function registerScreenshotsIpc(router: Router): void {
  const rootOf = (instanceId: string) => getServices().instances.dirOf(instanceId)

  router.handle('screenshots:list', S.ScreenshotsListSchema, async (input: any) =>
    listScreenshots(rootOf(input.instanceId)),
  )

  router.handle('screenshots:copy', S.ScreenshotsCopySchema, async (input: any) => {
    const image = nativeImage.createFromPath(screenshotPath(rootOf(input.instanceId), input.file))
    if (image.isEmpty()) throw new Error('Could not read screenshot')
    const png = image.toPNG()
    const bytes = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
    await clipboard.write([
      new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) }),
    ])
  })

  router.handle('screenshots:trash', S.ScreenshotsTrashSchema, async (input: any) => {
    await shell.trashItem(screenshotPath(rootOf(input.instanceId), input.file))
  })
}
