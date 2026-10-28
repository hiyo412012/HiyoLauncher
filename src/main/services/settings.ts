import path from 'node:path'
import { JsonStore, mergeDeep } from './store'
import type { Paths } from './paths'
import type { Settings, SettingsPatch } from '../../shared/types'

export const DEFAULT_SETTINGS_BASE = (userData: string): Settings => ({
  version: 1,
  theme: 'ocean',
  mode: 'dark',
  accent: '#5ec8d8',
  background: { type: 'none', blur: 0, dim: 0, opacity: 1 },
  density: 'cozy',
  fontScale: 1,
  language: 'vi',
  sidebarSide: 'left',
  animations: true,
  discordRpc: false,
  discordClientId: '',
  gameRoot: path.join(userData, 'minecraft'),
  defaultMemoryMb: 2048,
  msClientId: '',
  closeToTray: false,
  onboardingDone: false,
  showSnapshots: false,
  concurrency: 4,
})

export class SettingsService {
  private store: JsonStore<Settings>
  private paths: Paths
  private userData: string
  private defaults: Settings

  constructor(userData: string, paths: Paths) {
    this.userData = userData
    this.paths = paths
    this.defaults = DEFAULT_SETTINGS_BASE(userData)
    this.store = new JsonStore<Settings>(paths.settingsFile)
  }

  async get(): Promise<Settings> {
    const s = await this.store.read(this.defaults)
    // migrate gameRoot into paths
    this.paths.setGameRoot(s.gameRoot)
    try { await this.paths.ensureDirs() } catch {}
    return s
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    const current = await this.get()
    const merged = mergeDeep(current, patch) as Settings
    // validate-ish: ensure gameRoot
    if (patch.gameRoot) {
      this.paths.setGameRoot(merged.gameRoot)
      try { await this.paths.ensureDirs() } catch {}
    }
    await this.store.write(merged)
    return merged
  }

  async reset(): Promise<Settings> {
    const s = { ...this.defaults }
    this.paths.setGameRoot(s.gameRoot)
    try { await this.paths.ensureDirs() } catch {}
    await this.store.write(s)
    return s
  }

  getStore(): JsonStore<Settings> { return this.store }
}
