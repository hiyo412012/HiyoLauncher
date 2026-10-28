import type {
  Account,
  AppInfo,
  CrashAnalysis,
  DeviceCodeInfo,
  GamePhase,
  GameState,
  Instance,
  JavaInfo,
  LaunchRequest,
  Loader,
  LogFileInfo,
  MinecraftVersionSummary,
  MrProject,
  MrSearchResponse,
  MrVersion,
  ServerEntry,
  ServerStatus,
  Settings,
  SettingsPatch,
  UpdaterStatus,
  InstalledContent,
  ContentInstallRequest,
  ContentToggleRequest,
  ContentRemoveRequest,
  ContentUpdateRequest,
  ModpackInstallRequest,
  SkinUploadRequest,
  SkinOfflineRequest,
} from './types'

export const IPC = {
  app: {
    info: 'app:info',
    openExternal: 'app:openExternal',
    pickDirectory: 'app:pickDirectory',
    pickFile: 'app:pickFile',
    revealPath: 'app:revealPath',
    versions: 'app:versions',
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    reset: 'settings:reset',
  },
  instances: {
    list: 'instances:list',
    create: 'instances:create',
    update: 'instances:update',
    remove: 'instances:remove',
    clone: 'instances:clone',
    repair: 'instances:repair',
    openFolder: 'instances:openFolder',
    setIcon: 'instances:setIcon',
  },
  versions: {
    list: 'versions:list',
    loaders: 'versions:loaders',
    loaderVersions: 'versions:loaderVersions',
  },
  java: {
    detect: 'java:detect',
    install: 'java:install',
  },
  launch: {
    start: 'launch:start',
    stop: 'launch:stop',
    status: 'launch:status',
  },
  accounts: {
    list: 'accounts:list',
    addOffline: 'accounts:addOffline',
    remove: 'accounts:remove',
    msLogin: 'accounts:msLogin',
    cancelMsLogin: 'accounts:cancelMsLogin',
    refresh: 'accounts:refresh',
  },
  modrinth: {
    search: 'modrinth:search',
    project: 'modrinth:project',
    versions: 'modrinth:versions',
  },
  content: {
    list: 'content:list',
    install: 'content:install',
    toggle: 'content:toggle',
    remove: 'content:remove',
    checkUpdates: 'content:checkUpdates',
    update: 'content:update',
  },
  modpack: {
    search: 'modpack:search',
    install: 'modpack:install',
    checkUpdate: 'modpack:checkUpdate',
    update: 'modpack:update',
  },
  servers: {
    list: 'servers:list',
    add: 'servers:add',
    remove: 'servers:remove',
    ping: 'servers:ping',
    join: 'servers:join',
  },
  skins: {
    get: 'skins:get',
    upload: 'skins:upload',
    setOffline: 'skins:setOffline',
  },
  logs: {
    list: 'logs:list',
    read: 'logs:read',
    analyze: 'logs:analyze',
    export: 'logs:export',
    tail: 'logs:tail',
  },
  misc: {
    discordSet: 'misc:discordSet',
    updaterCheck: 'misc:updaterCheck',
    updaterDownload: 'misc:updaterDownload',
    updaterInstall: 'misc:updaterInstall',
  },
} as const

export const EVENTS = {
  gameState: 'game:state',
  gameLog: 'game:log',
  gameExit: 'game:exit',
  authDeviceCode: 'auth:device-code',
  updaterStatus: 'updater:status',
  logTail: 'logs:tail:data',
} as const

export type Unsubscribe = () => void

export interface HiyoApi {
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    pickDirectory(): Promise<string | null>
    pickFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null>
    revealPath(p: string): Promise<void>
    versions(): Promise<string[]>
  }
  settings: {
    get(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
    reset(): Promise<Settings>
  }
  instances: {
    list(): Promise<Instance[]>
    create(input: { name: string; mcVersion: string; loader: Loader; loaderVersion?: string; icon?: string }): Promise<Instance>
    update(id: string, patch: Partial<Instance>): Promise<Instance>
    remove(id: string, deleteFiles?: boolean): Promise<void>
    clone(id: string, newName: string): Promise<Instance>
    repair(id: string): Promise<void>
    openFolder(id: string): Promise<void>
    setIcon(id: string, dataUrl: string): Promise<void>
  }
  versions: {
    list(force?: boolean): Promise<MinecraftVersionSummary[]>
    loaders(type: Loader, mcVersion: string): Promise<import('./types').LoaderVersionSummary[]>
    loaderVersions(type: Loader, mcVersion: string): Promise<import('./types').LoaderVersionSummary[]>
  }
  java: {
    detect(): Promise<JavaInfo[]>
    install(major: number): Promise<string>
  }
  launch: {
    start(req: LaunchRequest): Promise<{ pid: number }>
    stop(instanceId: string): Promise<void>
    status(): Promise<GameState[]>
  }
  accounts: {
    list(): Promise<Account[]>
    addOffline(name: string): Promise<Account>
    remove(id: string): Promise<void>
    msLogin(): Promise<Account | null>
    cancelMsLogin(): Promise<void>
    refresh(id: string): Promise<Account>
  }
  modrinth: {
    search(params: import('./types').MrSearchParams): Promise<MrSearchResponse>
    project(id: string): Promise<MrProject>
    versions(projectId: string, filters?: { loader?: string; mcVersion?: string }): Promise<MrVersion[]>
  }
  content: {
    list(instanceId: string): Promise<InstalledContent[]>
    install(req: ContentInstallRequest): Promise<InstalledContent>
    toggle(req: ContentToggleRequest): Promise<void>
    remove(req: ContentRemoveRequest): Promise<void>
    checkUpdates(instanceId: string): Promise<{ path: string; latestVersionId: string }[]>
    update(req: ContentUpdateRequest): Promise<InstalledContent>
  }
  modpack: {
    search(params: import('./types').MrSearchParams): Promise<MrSearchResponse>
    install(req: ModpackInstallRequest): Promise<{ instanceId: string }>
    checkUpdate(instanceId: string): Promise<{ available: boolean; versionId?: string }>
    update(instanceId: string): Promise<void>
  }
  servers: {
    list(): Promise<ServerEntry[]>
    add(entry: ServerEntry): Promise<ServerEntry[]>
    remove(index: number): Promise<void>
    ping(entry: { host: string; port?: number }): Promise<ServerStatus>
    join(instanceId: string, index: number, accountId?: string): Promise<void>
  }
  skins: {
    get(accountId: string): Promise<{ url?: string; model?: string }>
    upload(req: SkinUploadRequest): Promise<void>
    setOffline(req: SkinOfflineRequest): Promise<void>
  }
  logs: {
    list(instanceId?: string): Promise<LogFileInfo[]>
    read(path: string, lines?: number): Promise<string>
    analyze(path: string): Promise<CrashAnalysis>
    export(path: string): Promise<string>
    tail(instanceId: string, cb: (chunk: string) => void): Unsubscribe
  }
  misc: {
    discordSet(enabled: boolean): Promise<void>
    updaterCheck(): Promise<UpdaterStatus>
    updaterDownload(): Promise<void>
    updaterInstall(): Promise<void>
  }
  onGameState(cb: (s: GameState) => void): Unsubscribe
  onGameLog(cb: (payload: { instanceId: string; lines: string[] }) => void): Unsubscribe
  onGameExit(cb: (payload: { instanceId: string; code: number | null }) => void): Unsubscribe
  onAuthDeviceCode(cb: (info: DeviceCodeInfo) => void): Unsubscribe
  onUpdaterStatus(cb: (s: UpdaterStatus) => void): Unsubscribe
}

