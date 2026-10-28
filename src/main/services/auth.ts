import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { BrowserWindow, safeStorage } from 'electron'
import { MicrosoftAuthenticator } from '@xmcl/user'
import type { Account, DeviceCodeInfo } from '../../shared/types'
import { getPaths } from './paths'
import { getSettings } from './settings'
import { getLogger } from './logger'

interface StoredAccount {
  id: string
  type: 'microsoft' | 'offline'
  name: string
  uuid: string
  createdAt: number
  expiresAt?: number
  skinUrl?: string
  avatarUrl?: string
  /** `enc:<base64>` when safeStorage is available, `plain:<base64>` otherwise. */
  refreshToken?: string
}

interface AccountsFile {
  version: 1
  selectedId?: string
  accounts: StoredAccount[]
}

interface CachedToken {
  accessToken: string
  expiresAt: number
  name: string
  uuid: string
}

export interface LaunchAuth {
  accessToken: string
  uuid: string
  name: string
  userType: 'mojang' | 'legacy'
  properties: Record<string, unknown>
}

const accessCache = new Map<string, CachedToken>()
let loginAbort: AbortController | null = null

function accountsPath(): string {
  return getPaths().accountsFile
}

async function loadFile(): Promise<AccountsFile> {
  try {
    const raw = await fs.readFile(accountsPath(), 'utf8')
    const parsed = JSON.parse(raw) as AccountsFile
    if (!Array.isArray(parsed.accounts)) return { version: 1, accounts: [] }
    return parsed
  } catch {
    return { version: 1, accounts: [] }
  }
}

async function saveFile(file: AccountsFile): Promise<void> {
  const filePath = accountsPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmp = filePath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(file, null, 2), { encoding: 'utf8', mode: 0o600 })
  await fs.rename(tmp, filePath)
}

function toPublic(account: StoredAccount): Account {
  return {
    id: account.id,
    type: account.type,
    name: account.name,
    uuid: account.uuid,
    skinUrl: account.skinUrl,
    avatarUrl: account.avatarUrl,
    createdAt: account.createdAt,
    expiresAt: account.expiresAt,
  }
}

export function offlineUuid(name: string): string {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest()
  // RFC 4122 version 3 (MD5) + variant 10xx
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function normalizeUuid(uuid: string): string {
  const clean = uuid.replace(/-/g, '').toLowerCase()
  if (clean.length !== 32) return uuid
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
}

export async function listAccounts(): Promise<Account[]> {
  const file = await loadFile()
  return file.accounts.map(toPublic)
}

export async function addOfflineAccount(name: string): Promise<Account> {
  const clean = name.trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(clean)) {
    const e: any = new Error('Username must be 3-16 characters (A-Z, a-z, 0-9, _)')
    e.code = 'VALIDATION'
    throw e
  }
  const file = await loadFile()
  const uuid = offlineUuid(clean)
  const existing = file.accounts.find((a) => a.type === 'offline' && a.uuid === uuid)
  if (existing) return toPublic(existing)
  const account: StoredAccount = {
    id: uuid,
    type: 'offline',
    name: clean,
    uuid,
    createdAt: Date.now(),
  }
  file.accounts.push(account)
  if (!file.selectedId) file.selectedId = account.id
  await saveFile(file)
  return toPublic(account)
}

export async function removeAccount(id: string): Promise<void> {
  const file = await loadFile()
  file.accounts = file.accounts.filter((a) => a.id !== id)
  accessCache.delete(id)
  if (file.selectedId === id) file.selectedId = file.accounts[0]?.id
  await saveFile(file)
}

export async function selectAccount(id: string): Promise<void> {
  const file = await loadFile()
  if (!file.accounts.some((a) => a.id === id)) {
    const e: any = new Error('Account not found')
    e.code = 'NOT_FOUND'
    throw e
  }
  file.selectedId = id
  await saveFile(file)
}

export function cancelMsLogin(): void {
  loginAbort?.abort()
  loginAbort = null
}

function emitDeviceCode(info: DeviceCodeInfo): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('auth:device-code', info)
    } catch {
      // window may be destroyed
    }
  }
}

function errorWith(code: string, message: string): Error {
  const e: any = new Error(message)
  e.code = code
  return e
}

async function clientId(): Promise<string> {
  const settings = await getSettings()
  const id = (settings.msClientId || process.env.MS_CLIENT_ID || '').trim()
  if (!id) {
    throw errorWith(
      'AUTH',
      'Microsoft login needs an Azure public client ID. Add one in Settings → Advanced, or set MS_CLIENT_ID.',
    )
  }
  return id
}

interface MsTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

async function postForm(url: string, body: Record<string, string>, signal?: AbortSignal): Promise<MsTokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal,
  })
  return (await res.json()) as MsTokenResponse
}

interface MsProfile {
  id: string
  name: string
  skins?: { id: string; state: string; url: string; variant?: string }[]
  capes?: { id: string; state: string; url: string; alias?: string }[]
}

async function exchangeForMinecraft(msAccessToken: string, signal?: AbortSignal): Promise<{
  accessToken: string
  name: string
  uuid: string
  skinUrl?: string
  expiresIn: number
}> {
  const authenticator = new MicrosoftAuthenticator()
  const xbl = await authenticator.authenticateXboxLive(msAccessToken, signal)
  const xsts = await authenticator.authorizeXboxLive(xbl.Token, undefined, signal)
  const uhs = xsts.DisplayClaims.xui[0]?.uhs
  if (!uhs) throw errorWith('AUTH', 'Xbox did not return a user hash')
  const mc = await authenticator.loginMinecraftWithXBox(uhs, xsts.Token, signal)
  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mc.access_token}` },
    signal,
  })
  if (!profileRes.ok) {
    if (profileRes.status === 404) {
      throw errorWith('AUTH', 'This Microsoft account does not own Minecraft: Java Edition')
    }
    throw errorWith('AUTH', `Minecraft profile request failed (${profileRes.status})`)
  }
  const profile = (await profileRes.json()) as MsProfile
  const skin = profile.skins?.find((s) => s.state === 'ACTIVE') ?? profile.skins?.[0]
  return {
    accessToken: mc.access_token,
    name: profile.name,
    uuid: normalizeUuid(profile.id),
    skinUrl: skin?.url,
    expiresIn: mc.expires_in ?? 3600,
  }
}

function encryptRefresh(token: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(token).toString('base64')
    }
  } catch {
    // fall through
  }
  // Never store a refresh token without OS-level encryption.
  getLogger().warn('safeStorage unavailable; Microsoft session will not persist')
  return ''
}

function decryptRefresh(value: string | undefined): string | null {
  if (!value) return null
  try {
    if (value.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    }
    if (value.startsWith('plain:')) {
      return Buffer.from(value.slice(6), 'base64').toString('utf8')
    }
  } catch {
    return null
  }
  return null
}

/**
 * Runs the Microsoft device-code flow. The renderer receives `auth:device-code`
 * so it can show the code while this promise polls in the background.
 */
export async function startMicrosoftLogin(): Promise<Account> {
  const id = await clientId()
  cancelMsLogin()
  const abort = new AbortController()
  loginAbort = abort

  const device = await postForm('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
    client_id: id,
    scope: 'XboxLive.signin offline_access',
  })
  const deviceAny = device as unknown as {
    device_code?: string
    user_code?: string
    verification_uri?: string
    expires_in?: number
    interval?: number
    message?: string
    error_description?: string
  }
  if (!deviceAny.device_code || !deviceAny.user_code) {
    throw errorWith('AUTH', deviceAny.error_description || 'Microsoft did not return a device code')
  }

  const interval = Math.max(2, deviceAny.interval ?? 5) * 1000
  const expiresAt = Date.now() + (deviceAny.expires_in ?? 900) * 1000
  emitDeviceCode({
    userCode: deviceAny.user_code,
    verificationUri: deviceAny.verification_uri ?? 'https://microsoft.com/link',
    expiresIn: deviceAny.expires_in ?? 900,
    interval: deviceAny.interval ?? 5,
  })

  let token: MsTokenResponse | null = null
  while (Date.now() < expiresAt) {
    if (abort.signal.aborted) throw errorWith('AUTH', 'Login cancelled')
    await new Promise((r) => setTimeout(r, interval))
    token = await postForm(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: id,
        device_code: deviceAny.device_code,
      },
      abort.signal,
    )
    if (token.access_token) break
    if (token.error === 'authorization_pending') continue
    if (token.error === 'slow_down') {
      await new Promise((r) => setTimeout(r, interval))
      continue
    }
    if (token.error === 'expired_token') throw errorWith('AUTH', 'The device code expired. Please try again.')
    if (token.error === 'authorization_declined') throw errorWith('AUTH', 'Login was declined.')
    if (token.error) throw errorWith('AUTH', token.error_description || token.error)
  }
  if (!token?.access_token) throw errorWith('AUTH', 'Microsoft login timed out')

  const mc = await exchangeForMinecraft(token.access_token, abort.signal)
  const file = await loadFile()
  const account: StoredAccount = {
    id: mc.uuid,
    type: 'microsoft',
    name: mc.name,
    uuid: mc.uuid,
    createdAt: file.accounts.find((a) => a.id === mc.uuid)?.createdAt ?? Date.now(),
    expiresAt: Date.now() + (mc.expiresIn - 60) * 1000,
    skinUrl: mc.skinUrl,
    refreshToken: token.refresh_token ? encryptRefresh(token.refresh_token) : undefined,
  }
  accessCache.set(account.id, {
    accessToken: mc.accessToken,
    expiresAt: account.expiresAt ?? Date.now() + 3000_000,
    name: mc.name,
    uuid: mc.uuid,
  })
  const idx = file.accounts.findIndex((a) => a.id === account.id)
  if (idx >= 0) file.accounts[idx] = account
  else file.accounts.push(account)
  file.selectedId = account.id
  await saveFile(file)
  loginAbort = null
  getLogger().info('microsoft login ok', { name: account.name })
  return toPublic(account)
}

async function refreshMicrosoft(account: StoredAccount): Promise<CachedToken> {
  const id = await clientId()
  const refreshToken = decryptRefresh(account.refreshToken)
  if (!refreshToken) throw errorWith('AUTH', 'No saved Microsoft session. Please sign in again.')

  const token = await postForm('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    grant_type: 'refresh_token',
    client_id: id,
    refresh_token: refreshToken,
    scope: 'XboxLive.signin offline_access',
  })
  if (!token.access_token) {
    throw errorWith('AUTH', token.error_description || 'Could not refresh Microsoft session')
  }
  const mc = await exchangeForMinecraft(token.access_token)
  const cached: CachedToken = {
    accessToken: mc.accessToken,
    expiresAt: Date.now() + (mc.expiresIn - 60) * 1000,
    name: mc.name,
    uuid: mc.uuid,
  }
  accessCache.set(account.id, cached)
  if (token.refresh_token) {
    const file = await loadFile()
    const stored = file.accounts.find((a) => a.id === account.id)
    if (stored) {
      stored.refreshToken = encryptRefresh(token.refresh_token)
      stored.expiresAt = cached.expiresAt
      await saveFile(file)
    }
  }
  return cached
}

export async function refreshAccount(id: string): Promise<Account> {
  const file = await loadFile()
  const account = file.accounts.find((a) => a.id === id)
  if (!account) throw errorWith('NOT_FOUND', 'Account not found')
  if (account.type === 'microsoft') await refreshMicrosoft(account)
  return toPublic(account)
}

export async function getLaunchAuth(accountId: string): Promise<LaunchAuth> {
  const file = await loadFile()
  const account = file.accounts.find((a) => a.id === accountId)
  if (!account) throw errorWith('AUTH', 'Account not found')

  if (account.type === 'offline') {
    return {
      accessToken: crypto.randomBytes(16).toString('hex'),
      uuid: account.uuid,
      name: account.name,
      userType: 'legacy',
      properties: {},
    }
  }

  let cached = accessCache.get(account.id)
  if (!cached || cached.expiresAt <= Date.now()) {
    cached = await refreshMicrosoft(account)
  }
  return {
    accessToken: cached.accessToken,
    uuid: cached.uuid,
    name: cached.name,
    userType: 'mojang',
    properties: {},
  }
}

export async function getMicrosoftAccessToken(accountId: string): Promise<string> {
  const auth = await getLaunchAuth(accountId)
  return auth.accessToken
}

export async function getStoredAccount(accountId: string): Promise<Account | null> {
  const file = await loadFile()
  const account = file.accounts.find((a) => a.id === accountId)
  return account ? toPublic(account) : null
}
