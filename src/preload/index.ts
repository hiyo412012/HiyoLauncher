import { contextBridge, ipcRenderer } from 'electron'
import { IPC, EVENTS } from '../shared/ipc'
import type { HiyoApi } from '../shared/ipc'

class HiyoError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'HiyoError'
  }
}

async function invoke(channel: string, payload?: any): Promise<any> {
  const res = await ipcRenderer.invoke(channel, payload)
  if (res && typeof res === 'object' && 'ok' in res) {
    if (res.ok) return res.data
    const err = res.error ?? { code: 'UNKNOWN', message: 'unknown error' }
    throw new HiyoError(err.code, err.message)
  }
  return res
}

function sub(channel: string, cb: (data: any) => void): () => void {
  const handler = (_e: any, data: any) => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: HiyoApi = {
  app: {
    info: () => invoke(IPC.app.info),
    openExternal: (url) => invoke(IPC.app.openExternal, { url }),
    pickDirectory: () => invoke(IPC.app.pickDirectory),
    pickFile: (filters) => invoke(IPC.app.pickFile, { filters }),
    revealPath: (p) => invoke(IPC.app.revealPath, { path: p }),
    versions: () => invoke(IPC.app.versions),
  },
  settings: {
    get: () => invoke(IPC.settings.get),
    update: (patch) => invoke(IPC.settings.update, { patch }),
    reset: () => invoke(IPC.settings.reset),
  },
  instances: {
    list: () => invoke(IPC.instances.list),
    create: (input) => invoke(IPC.instances.create, input),
    update: (id, patch) => invoke(IPC.instances.update, { id, patch }),
    remove: (id, deleteFiles) => invoke(IPC.instances.remove, { id, deleteFiles: deleteFiles ?? false }),
    clone: (id, newName) => invoke(IPC.instances.clone, { id, newName }),
    repair: (id) => invoke(IPC.instances.repair, { id }),
    openFolder: (id) => invoke(IPC.instances.openFolder, { id }),
    setIcon: (id, dataUrl) => invoke(IPC.instances.setIcon, { id, dataUrl }),
  },
  versions: {
    list: (force) => invoke(IPC.versions.list, { force }),
    loaders: (type, mcVersion) => invoke(IPC.versions.loaders, { type, mcVersion }),
    loaderVersions: (type, mcVersion) => invoke(IPC.versions.loaderVersions, { type, mcVersion }),
  },
  java: {
    detect: () => invoke(IPC.java.detect),
    install: (major) => invoke(IPC.java.install, { major }),
  },
  launch: {
    start: (req) => invoke(IPC.launch.start, req),
    stop: (instanceId) => invoke(IPC.launch.stop, { instanceId }),
    status: () => invoke(IPC.launch.status),
  },
  accounts: {
    list: () => invoke(IPC.accounts.list),
    addOffline: (name) => invoke(IPC.accounts.addOffline, { name }),
    remove: (id) => invoke(IPC.accounts.remove, { id }),
    msLogin: () => invoke(IPC.accounts.msLogin),
    cancelMsLogin: () => invoke(IPC.accounts.cancelMsLogin),
    refresh: (id) => invoke(IPC.accounts.refresh, { id }),
  },
  modrinth: {
    search: (params) => invoke(IPC.modrinth.search, params),
    project: (id) => invoke(IPC.modrinth.project, { id }),
    versions: (projectId, filters) => invoke(IPC.modrinth.versions, { projectId, ...filters }),
  },
  content: {
    list: (instanceId) => invoke(IPC.content.list, { instanceId }),
    install: (req) => invoke(IPC.content.install, req),
    toggle: (req) => invoke(IPC.content.toggle, req),
    remove: (req) => invoke(IPC.content.remove, req),
    checkUpdates: (instanceId) => invoke(IPC.content.checkUpdates, { instanceId }),
    update: (req) => invoke(IPC.content.update, req),
  },
  modpack: {
    search: (params) => invoke(IPC.modpack.search, params),
    install: (req) => invoke(IPC.modpack.install, req),
    checkUpdate: (instanceId) => invoke(IPC.modpack.checkUpdate, { instanceId }),
    update: (instanceId) => invoke(IPC.modpack.update, { instanceId }),
  },
  servers: {
    list: () => invoke(IPC.servers.list),
    add: (entry) => invoke(IPC.servers.add, entry),
    remove: (index) => invoke(IPC.servers.remove, { index }),
    ping: (entry) => invoke(IPC.servers.ping, entry),
    join: (instanceId, index) => invoke(IPC.servers.join, { instanceId, index }),
  },
  skins: {
    get: (accountId) => invoke(IPC.skins.get, { accountId }),
    upload: (req) => invoke(IPC.skins.upload, req),
    setOffline: (req) => invoke(IPC.skins.setOffline, req),
  },
  logs: {
    list: (instanceId) => invoke(IPC.logs.list, { instanceId }),
    read: (path, lines) => invoke(IPC.logs.read, { path, lines }),
    analyze: (path) => invoke(IPC.logs.analyze, { path }),
    export: (path) => invoke(IPC.logs.export, { path }),
    tail: (instanceId, cb) => {
      const unsub = sub(EVENTS.logTail, (data) => {
        if (data?.instanceId === instanceId) cb(data.chunk ?? '')
      })
      invoke(IPC.logs.tail, { instanceId }).catch(() => {})
      return unsub
    },
  },
  misc: {
    discordSet: (enabled) => invoke(IPC.misc.discordSet, { enabled }),
    updaterCheck: () => invoke(IPC.misc.updaterCheck),
    updaterDownload: () => invoke(IPC.misc.updaterDownload),
    updaterInstall: () => invoke(IPC.misc.updaterInstall),
  },
  onGameState: (cb) => sub(EVENTS.gameState, cb),
  onGameLog: (cb) => sub(EVENTS.gameLog, cb),
  onGameExit: (cb) => sub(EVENTS.gameExit, cb),
  onAuthDeviceCode: (cb) => sub(EVENTS.authDeviceCode, cb),
  onUpdaterStatus: (cb) => sub(EVENTS.updaterStatus, cb),
}

contextBridge.exposeInMainWorld('hiyo', api)
