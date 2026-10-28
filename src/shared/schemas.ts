import { z } from 'zod'
import type { ContentKind, Loader, SettingsPatch } from './types'

const idSchema = z.string().min(1).max(128)
const safeNameSchema = z.string().min(1).max(48)

export const IdSchema = idSchema
export const SafeNameSchema = safeNameSchema

export const SettingsPatchSchema = z.object({}).passthrough()

export const InstanceCreateSchema = z.object({
  name: z.string().min(1).max(48),
  mcVersion: z.string().min(1),
  loader: z.enum(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']),
  loaderVersion: z.string().optional(),
  icon: z.string().optional(),
})

export const InstanceUpdateSchema = z.object({
  id: idSchema,
  patch: z.object({}).passthrough(),
})

export const InstanceRemoveSchema = z.object({
  id: idSchema,
  deleteFiles: z.boolean().optional().default(false),
})

export const InstanceCloneSchema = z.object({
  id: idSchema,
  newName: z.string().min(1).max(48),
})

export const InstanceRepairSchema = z.object({ id: idSchema })
export const InstanceOpenFolderSchema = z.object({ id: idSchema })
export const InstanceSetIconSchema = z.object({
  id: idSchema,
  dataUrl: z.string().min(1),
})

export const LaunchStartSchema = z.object({
  instanceId: idSchema,
  accountId: idSchema.optional(),
  server: z.object({ host: z.string().min(1), port: z.number().int().positive().optional() }).optional(),
  quickPlay: z.object({ type: z.enum(['singleplayer', 'multiplayer', 'realms']), value: z.string().optional() }).optional(),
})

export const LaunchStopSchema = z.object({ instanceId: idSchema })

export const AccountAddOfflineSchema = z.object({ name: z.string().min(1).max(16) })
export const AccountRemoveSchema = z.object({ id: idSchema })
export const AccountRefreshSchema = z.object({ id: idSchema })

export const MsLoginSchema = z.object({}).optional()

export const VersionsListSchema = z.object({ force: z.boolean().optional() })
export const LoadersSchema = z.object({
  type: z.enum(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']),
  mcVersion: z.string().min(1),
})
export const LoaderVersionsSchema = LoadersSchema

export const JavaDetectSchema = z.object({}).optional()
export const JavaInstallSchema = z.object({ major: z.number().int().positive() })

export const ModrinthSearchSchema = z.object({
  query: z.string().optional(),
  projectType: z.string().optional(),
  loader: z.string().optional(),
  mcVersion: z.string().optional(),
  category: z.string().optional(),
  sort: z.string().optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(100).optional(),
  facets: z.array(z.array(z.string())).optional(),
})

export const ModrinthProjectSchema = z.object({ id: z.string().min(1) })
export const ModrinthVersionsSchema = z.object({
  projectId: z.string().min(1),
  loader: z.string().optional(),
  mcVersion: z.string().optional(),
})

export const ContentListSchema = z.object({ instanceId: idSchema })
export const ContentInstallSchema = z.object({
  instanceId: idSchema,
  projectId: z.string().min(1),
  versionId: z.string().optional(),
  kind: z.enum(['mod', 'resourcepack', 'shader', 'datapack']),
})
export const ContentToggleSchema = z.object({
  instanceId: idSchema,
  path: z.string().min(1),
  enabled: z.boolean(),
})
export const ContentRemoveSchema = z.object({
  instanceId: idSchema,
  path: z.string().min(1),
})
export const ContentCheckUpdatesSchema = z.object({ instanceId: idSchema })
export const ContentUpdateSchema = z.object({
  instanceId: idSchema,
  path: z.string().min(1),
  versionId: z.string().optional(),
})

export const ModpackSearchSchema = ModrinthSearchSchema
export const ModpackInstallSchema = z.object({
  projectId: z.string().optional(),
  filePath: z.string().optional(),
  name: z.string().optional(),
  versionId: z.string().optional(),
})
export const ModpackCheckUpdateSchema = z.object({ instanceId: idSchema })
export const ModpackUpdateSchema = z.object({ instanceId: idSchema })

export const ServersListSchema = z.object({}).optional()
export const ServersAddSchema = z.object({
  name: z.string().min(1).max(64),
  ip: z.string().min(1),
})
export const ServersRemoveSchema = z.object({ index: z.number().int().nonnegative() })
export const ServersPingSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().optional(),
})
export const ServersJoinSchema = z.object({
  instanceId: idSchema,
  index: z.number().int().nonnegative(),
  accountId: idSchema.optional(),
})

export const SkinsGetSchema = z.object({ accountId: idSchema })
export const SkinsUploadSchema = z.object({
  accountId: idSchema,
  filePath: z.string().optional(),
  dataUrl: z.string().optional(),
  variant: z.enum(['classic', 'slim']),
})
export const SkinsSetOfflineSchema = z.object({
  accountId: idSchema,
  filePath: z.string().min(1),
})

export const LogsListSchema = z.object({ instanceId: idSchema.optional() })
export const LogsReadSchema = z.object({
  path: z.string().min(1),
  lines: z.number().int().positive().optional(),
})
export const LogsAnalyzeSchema = z.object({ path: z.string().min(1) })
export const LogsExportSchema = z.object({ path: z.string().min(1) })
export const LogsTailSchema = z.object({ instanceId: idSchema })

export const AppOpenExternalSchema = z.object({ url: z.string().url() })
export const AppPickDirectorySchema = z.object({}).optional()
export const AppPickFileSchema = z.object({ filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional() })
export const AppRevealPathSchema = z.object({ path: z.string().min(1) })

export const SettingsGetSchema = z.object({}).optional()
export const SettingsUpdateSchema = z.object({ patch: z.record(z.string(), z.unknown()) })
export const SettingsResetSchema = z.object({}).optional()

export const MiscDiscordSetSchema = z.object({ enabled: z.boolean() })
export const MiscUpdaterCheckSchema = z.object({}).optional()
export const MiscUpdaterDownloadSchema = z.object({}).optional()
export const MiscUpdaterInstallSchema = z.object({}).optional()

export const EmptySchema = z.object({}).optional()

export type Inferred<T> = T extends z.ZodTypeAny ? z.infer<T> : never

