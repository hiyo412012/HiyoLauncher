import { createRouter } from './router'
import { registerAppIpc } from './domains/app'
import { registerSettingsIpc } from './domains/settings'
import { registerInstancesIpc } from './domains/instances'
import { registerGameIpc } from './domains/game'
import { registerAuthIpc } from './domains/auth'
import { registerContentIpc } from './domains/content'
import { registerServersIpc } from './domains/servers'
import { registerSkinsIpc } from './domains/skins'
import { registerLogsIpc } from './domains/logs'
import { registerFilesIpc } from './domains/files'
import { registerWorldsIpc } from './domains/worlds'
import { registerScreenshotsIpc } from './domains/screenshots'
import { registerMiscIpc } from './domains/misc'

export function registerIpc(): void {
  const router = createRouter()
  registerAppIpc(router)
  registerSettingsIpc(router)
  registerInstancesIpc(router)
  registerGameIpc(router)
  registerAuthIpc(router)
  registerContentIpc(router)
  registerServersIpc(router)
  registerSkinsIpc(router)
  registerLogsIpc(router)
  registerFilesIpc(router)
  registerWorldsIpc(router)
  registerScreenshotsIpc(router)
  registerMiscIpc(router)
}
