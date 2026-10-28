import { getSettings, updateSettings } from './settings'
import { getLogger } from './logger'
import { getInstance } from './instances'

let client: any = null
let connected = false
let connectAttempts = 0
let lastPresence: Presence | null = null

export interface Presence {
  instanceId?: string
  instanceName?: string
  mcVersion?: string
  loader?: string
  startedAt?: number
}

/**
 * Optional Discord Rich Presence. Every failure is swallowed: Discord not
 * running must never break the launcher.
 */
export async function syncDiscord(): Promise<void> {
  try {
    const settings = await getSettings()
    if (!settings.discordRpc) {
      await disconnectDiscord()
      return
    }
    await connectDiscord(settings.discordClientId)
  } catch (e: any) {
    getLogger().warn('discord sync failed', { message: e?.message })
  }
}

async function connectDiscord(clientId: string): Promise<void> {
  if (!clientId) {
    getLogger().warn('discord RPC enabled without an application id')
    return
  }
  if (connected && client?.clientId === clientId) return
  await disconnectDiscord()
  try {
    const mod: any = await import('@xhayper/discord-rpc')
    const Client = mod.Client ?? mod.default?.Client
    if (!Client) return
    client = new Client({ clientId })
    client.on?.('disconnected', () => {
      connected = false
    })
    await client.login()
    connected = true
    connectAttempts = 0
    if (lastPresence) await applyPresence(lastPresence)
  } catch (e: any) {
    connectAttempts++
    connected = false
    getLogger().warn('discord connect failed', { attempt: connectAttempts, message: e?.message })
  }
}

export async function disconnectDiscord(): Promise<void> {
  try {
    if (client) await client.destroy?.()
  } catch {}
  client = null
  connected = false
}

export async function setPresence(presence: Presence | null): Promise<void> {
  lastPresence = presence
  if (!connected) return
  try {
    if (!presence) {
      await client?.user?.clearActivity?.()
      return
    }
    await applyPresence(presence)
  } catch (e: any) {
    getLogger().warn('discord presence failed', { message: e?.message })
  }
}

async function applyPresence(presence: Presence): Promise<void> {
  if (!client?.user) return
  let instanceName = presence.instanceName
  let mcVersion = presence.mcVersion
  let loader = presence.loader
  if (presence.instanceId && !instanceName) {
    try {
      const instance = await getInstance(presence.instanceId)
      instanceName = instance.name
      mcVersion = instance.mcVersion
      loader = instance.loader
    } catch {}
  }
  await client.user.setActivity({
    details: instanceName ? `Playing ${instanceName}` : 'In the launcher',
    state: mcVersion
      ? `Minecraft ${mcVersion}${loader && loader !== 'vanilla' ? ` • ${loader}` : ''}`
      : 'Browsing HiyoLauncher',
    startTimestamp: presence.startedAt ?? Date.now(),
    instance: false,
  })
}

export async function setDiscordEnabled(enabled: boolean, clientId?: string): Promise<void> {
  const patch: any = { discordRpc: enabled }
  if (typeof clientId === 'string') patch.discordClientId = clientId
  await updateSettings(patch)
  if (enabled) await syncDiscord()
  else await disconnectDiscord()
}

/** Called from the game service on launch/exit when available. */
export async function onGameState(state: {
  phase: string
  instanceId?: string
  instanceName?: string
  mcVersion?: string
  loader?: string
  startedAt?: number
}): Promise<void> {
  try {
    if (state.phase === 'running') {
      await setPresence({
        instanceId: state.instanceId,
        instanceName: state.instanceName,
        mcVersion: state.mcVersion,
        loader: state.loader,
        startedAt: state.startedAt ?? Date.now(),
      })
    } else if (state.phase === 'exited' || state.phase === 'crashed') {
      await setPresence(null)
    }
  } catch {}
}
