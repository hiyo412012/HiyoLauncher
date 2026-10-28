export type Theme = 'ocean' | 'aurora' | 'voxel' | 'mono'
export type Mode = 'dark' | 'light' | 'system'
export type Density = 'cozy' | 'compact'
export type Language = 'vi' | 'en'
export type SidebarSide = 'left' | 'right'
export type BackgroundType = 'none' | 'gradient' | 'image' | 'video'

export interface BackgroundSettings {
  type: BackgroundType
  value?: string
  blur: number
  dim: number
  opacity: number
}

export interface Settings {
  version: number
  theme: Theme
  mode: Mode
  accent: string
  background: BackgroundSettings
  density: Density
  fontScale: number
  language: Language
  sidebarSide: SidebarSide
  animations: boolean
  discordRpc: boolean
  discordClientId: string
  gameRoot: string
  defaultMemoryMb: number
  msClientId: string
  closeToTray: boolean
  onboardingDone: boolean
  showSnapshots: boolean
  concurrency: number
}

export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type SettingsPatch = DeepPartial<Settings>

export type Loader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge'
export type AccountType = 'microsoft' | 'offline'

export interface InstanceResolution {
  width: number
  height: number
  fullscreen?: boolean
}

export interface ModpackRef {
  projectId: string
  versionId: string
  name: string
  version: string
}

export interface Instance {
  id: string
  name: string
  icon?: string
  cover?: string
  mcVersion: string
  loader: Loader
  loaderVersion?: string
  versionId: string
  createdAt: number
  lastPlayedAt?: number
  playTimeMs: number
  javaPath?: string
  memoryMb?: number
  jvmArgs?: string[]
  gameArgs?: string[]
  resolution?: InstanceResolution
  modpack?: ModpackRef
  notes?: string
  group?: string
}

export interface Account {
  id: string
  type: AccountType
  name: string
  uuid: string
  skinUrl?: string
  avatarUrl?: string
  createdAt: number
  expiresAt?: number
}

export interface MinecraftVersionSummary {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
}

export interface LoaderVersionSummary {
  loader: Loader
  version: string
  stable: boolean
  mcVersions?: string[]
}

export type GamePhase = 'idle' | 'preparing' | 'downloading' | 'launching' | 'running' | 'exited' | 'crashed'

export interface GameProgress {
  stage?: string
  current?: number
  total?: number
  bytesPerSec?: number
}

export interface GameState {
  instanceId: string
  phase: GamePhase
  pid?: number
  progress?: GameProgress
  startedAt?: number
  exitCode?: number
  error?: string
}

export type ContentKind = 'mod' | 'resourcepack' | 'shader' | 'datapack'

export interface InstalledContent {
  id: string
  instanceId: string
  kind: ContentKind
  filename: string
  enabled: boolean
  projectId?: string
  versionId?: string
  versionNumber?: string
  sha1?: string
  installedAt: number
}

export interface InstanceFileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
  managed: boolean
}

export interface ScreenshotEntry {
  file: string
  name: string
  sizeBytes: number
  createdAt: number
}

export interface WorldSummary {
  folder: string
  name: string
  lastPlayedAt?: number
  gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator'
  hardcore: boolean
  version?: string
  sizeBytes: number
}

export interface WorldBackup {
  file: string
  world: string
  createdAt: number
  sizeBytes: number
}

export interface WorldBackupProgress {
  instanceId: string
  world: string
  phase: 'compress' | 'extract'
  current: number
  total: number
}

export type ProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'plugin'

export interface MrFile {
  hashes: { sha1?: string; sha512?: string }
  url: string
  filename: string
  primary: boolean
  size: number
  fileType?: string
}

export interface MrDependency {
  versionId?: string
  projectId?: string
  dependencyType: 'required' | 'optional' | 'incompatible' | 'embedded'
}

export interface MrVersion {
  id: string
  projectId: string
  name: string
  versionNumber: string
  changelog?: string
  datePublished: string
  downloads: number
  versionType: 'release' | 'beta' | 'alpha'
  status: 'listed' | 'archived' | 'draft' | 'unlisted' | 'scheduled'
  requestedStatus?: string
  files: MrFile[]
  dependencies: MrDependency[]
  gameVersions: string[]
  loaders: string[]
  featured: boolean
}

export interface MrProject {
  id: string
  slug: string
  title: string
  description: string
  body?: string
  categories: string[]
  clientSide: 'required' | 'optional' | 'unsupported' | 'unknown'
  serverSide: 'required' | 'optional' | 'unsupported' | 'unknown'
  projectType: ProjectType
  downloads: number
  iconUrl?: string
  color?: number
  threadId?: string
  monetizationStatus?: string
  team?: string
  published?: string
  updated?: string
  approved?: string
  followers: number
  status?: string
  license?: { id: string; name: string; url?: string }
  versions?: string[]
  gallery?: unknown[]
}

export interface MrSearchHit {
  project_id: string
  project_type: string
  slug: string
  author: string
  title: string
  description: string
  categories: string[]
  display_categories: string[]
  versions: string[]
  downloads: number
  follows: number
  icon_url?: string
  color?: number
  thread_id?: string
  monetization_status?: string
  date_created: string
  date_modified: string
  latest_version?: string
  license?: string
  gallery?: string[]
}

export interface MrSearchResponse {
  hits: MrSearchHit[]
  offset: number
  limit: number
  total_hits: number
}

export interface MrSearchParams {
  query?: string
  projectType?: ProjectType
  loader?: Loader | string
  mcVersion?: string
  category?: string
  sort?: string
  offset?: number
  limit?: number
  facets?: string[][]
}

export interface ServerEntry {
  name: string
  ip: string
}

export interface ServerStatus {
  online: boolean
  players?: number
  max?: number
  version?: string
  motd?: string
  latency?: number
  icon?: string
  error?: string
}

export interface LogFileInfo {
  path: string
  instanceId?: string
  size: number
  modifiedAt: number
}

export type CrashCauseSeverity = 'info' | 'warning' | 'error' | 'fatal'

export interface CrashCause {
  id: string
  title: string
  tip: string
  severity: CrashCauseSeverity
  mods?: string[]
}

export interface CrashAnalysis {
  summary: string
  causes: CrashCause[]
  mods?: string[]
}

export interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  arch: string
  electron: string
  chrome: string
  node: string
  userData: string
  isPackaged: boolean
}

export type ApiErrorCode =
  | 'UNKNOWN'
  | 'VALIDATION'
  | 'PATH_UNSAFE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AUTH'
  | 'NETWORK'
  | 'FS'
  | 'JAVA'
  | 'VERSION'
  | 'MODRINTH'
  | 'LAUNCH'
  | 'NOT_IMPLEMENTED'
  | 'JAVA_TOO_OLD'

export interface ApiError {
  code: ApiErrorCode | string
  message: string
  detail?: unknown
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

export type UpdaterState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  version?: string
  progress?: number
  error?: string
}

export interface DeviceCodeInfo {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval?: number
}

export interface JavaInfo {
  path: string
  major: number
  version: string
  vendor?: string
}

export interface LaunchRequest {
  instanceId: string
  accountId?: string
  server?: { host: string; port?: number }
  quickPlay?: { type: 'singleplayer' | 'multiplayer' | 'realms'; value?: string }
}

export interface ContentInstallRequest {
  instanceId: string
  projectId: string
  versionId?: string
  kind: ContentKind
}

export interface ContentToggleRequest {
  instanceId: string
  path: string
  enabled: boolean
}

export interface ContentRemoveRequest {
  instanceId: string
  path: string
}

export interface ContentUpdateRequest {
  instanceId: string
  path: string
  versionId?: string
}

export interface ModpackInstallRequest {
  projectId?: string
  filePath?: string
  name?: string
  versionId?: string
}

export interface SkinUploadRequest {
  accountId: string
  filePath?: string
  dataUrl?: string
  variant: 'classic' | 'slim'
}

export interface SkinOfflineRequest {
  accountId: string
  filePath: string
}

export interface HiyoError extends Error {
  code: string
}

export class HiyoErrorImpl extends Error implements HiyoError {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'HiyoError'
  }
}

export type HiyoErrorType = HiyoError
