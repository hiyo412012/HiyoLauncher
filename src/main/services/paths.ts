import fs from 'node:fs/promises'
import path from 'node:path'

export interface Paths {
  userData: string
  gameRoot: string
  settingsFile: string
  accountsFile: string
  instancesDir: string
  sharedDir: string
  versionsDir: string
  librariesDir: string
  assetsDir: string
  runtimeDir: string
  cacheDir: string
  logsDir: string
  instanceDir(id: string): string
  ensureDirs(): Promise<void>
  setGameRoot(root: string): void
}

export class PathsImpl implements Paths {
  constructor(public userData: string, private _gameRoot: string) {}
  get gameRoot(): string { return this._gameRoot }
  setGameRoot(root: string): void { this._gameRoot = root }
  get settingsFile(): string { return path.join(this.userData, 'settings.json') }
  get accountsFile(): string { return path.join(this.userData, 'accounts.json') }
  get instancesDir(): string { return path.join(this.userData, 'instances') }
  // MinecraftFolder (XMCL) expects versions/libraries/assets directly under the game root.
  get sharedDir(): string { return this._gameRoot }
  get versionsDir(): string { return path.join(this._gameRoot, 'versions') }
  get librariesDir(): string { return path.join(this._gameRoot, 'libraries') }
  get assetsDir(): string { return path.join(this._gameRoot, 'assets') }
  get runtimeDir(): string { return path.join(this._gameRoot, 'runtime') }
  get cacheDir(): string { return path.join(this.userData, 'cache') }
  get logsDir(): string { return path.join(this.userData, 'logs') }
  instanceDir(id: string): string { return path.join(this.userData, 'instances', id) }
  async ensureDirs(): Promise<void> {
    const dirs = [
      this.userData,
      this.instancesDir,
      this._gameRoot,
      this.sharedDir,
      this.versionsDir,
      this.librariesDir,
      this.assetsDir,
      this.runtimeDir,
      this.cacheDir,
      this.logsDir,
    ]
    for (const d of dirs) await fs.mkdir(d, { recursive: true })
  }
}

export function createPaths(userData: string, gameRoot: string): Paths {
  return new PathsImpl(userData, gameRoot)
}

let activePaths: Paths | null = null

/** Set once during app startup; services should use getPaths() afterwards. */
export function setActivePaths(p: Paths): void {
  activePaths = p
}

export function getPaths(): Paths {
  if (!activePaths) throw new Error('PATHS_NOT_READY')
  return activePaths
}
