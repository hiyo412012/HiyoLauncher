import { app } from 'electron'
import path from 'node:path'
import { createPaths, setActivePaths, type Paths } from './paths'
import { SettingsService, setActiveSettings } from './settings'
import { InstanceService, setActiveInstances } from './instances'
import { createLogger, setActiveLogger, type Logger } from './logger'
import type { Settings } from '../../shared/types'

export interface AppServices {
  userData: string
  paths: Paths
  settings: SettingsService
  instances: InstanceService
  logger: Logger
}

let services: AppServices | null = null

/**
 * Single source of truth for main-process services. Safe to call more than once;
 * the first successful initialization wins.
 */
export async function initServices(): Promise<AppServices> {
  if (services) return services
  const userData = app.getPath('userData')
  const logger = createLogger(path.join(userData, 'logs', 'main.log'))
  setActiveLogger(logger)

  const paths = createPaths(userData, path.join(userData, 'minecraft'))
  setActivePaths(paths)

  const settings = new SettingsService(userData, paths)
  // settings.get() reads gameRoot and applies it to paths
  const current: Settings = await settings.get()
  logger.info('services initialized', { gameRoot: current.gameRoot })
  setActiveSettings(settings)

  const instances = new InstanceService(paths)
  setActiveInstances(instances)

  services = { userData, paths, settings, instances, logger }
  return services
}

export function getServices(): AppServices {
  if (!services) throw new Error('SERVICES_NOT_READY')
  return services
}
