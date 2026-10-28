import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SkinOfflineRequest, SkinUploadRequest } from '../../shared/types'
import { getPaths } from './paths'
import { getMicrosoftAccessToken, getStoredAccount, listAccounts } from './auth'

export interface SkinInfo {
  url?: string
  model?: 'classic' | 'slim'
  local?: boolean
}

function fail(code: string, message: string): never {
  const e: any = new Error(message)
  e.code = code
  throw e
}

/**
 * Validates a PNG buffer and returns its dimensions. Only 64x64 and 64x32
 * (legacy) Minecraft skins are accepted.
 */
export function readPngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') return null
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') return null
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  return { width, height }
}

export function validateSkinPng(buffer: Buffer): void {
  if (buffer.length > 1024 * 1024) fail('VALIDATION', 'Skin file must be smaller than 1 MB')
  const size = readPngSize(buffer)
  if (!size) fail('VALIDATION', 'File is not a valid PNG')
  if (!((size.width === 64 && size.height === 64) || (size.width === 64 && size.height === 32))) {
    fail('VALIDATION', `Unsupported skin size ${size.width}x${size.height}. Use 64x64 or 64x32.`)
  }
}

function localSkinFile(accountId: string): string {
  const safe = accountId.replace(/[^a-zA-Z0-9-]/g, '')
  return path.join(getPaths().userData, 'skins', `${safe}.png`)
}

export async function getSkin(accountId: string): Promise<SkinInfo> {
  const account = await getStoredAccount(accountId)
  if (!account) fail('NOT_FOUND', 'Account not found')

  if (account.type === 'offline') {
    try {
      const stat = await fs.stat(localSkinFile(accountId))
      if (stat.isFile()) {
        return { url: pathToFileURL(localSkinFile(accountId)).toString(), model: 'classic', local: true }
      }
    } catch {
      // no local skin
    }
    return { model: 'classic' }
  }

  try {
    const token = await getMicrosoftAccessToken(accountId)
    const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const profile = (await res.json()) as {
      skins?: { id: string; state: string; url: string; variant?: string }[]
    }
    const skin = profile.skins?.find((s) => s.state === 'ACTIVE') ?? profile.skins?.[0]
    if (!skin) return { model: 'classic' }
    return {
      url: skin.url,
      model: skin.variant === 'slim' ? 'slim' : 'classic',
    }
  } catch (e: any) {
    if (e?.code) throw e
    fail('AUTH', `Could not load Minecraft profile: ${e?.message ?? e}`)
  }
}

async function resolveUploadBuffer(req: SkinUploadRequest): Promise<Buffer> {
  if (req.dataUrl) {
    const match = /^data:image\/png;base64,(.+)$/i.exec(req.dataUrl)
    if (!match) fail('VALIDATION', 'Expected a PNG data URL')
    return Buffer.from(match[1], 'base64')
  }
  if (req.filePath) return fs.readFile(req.filePath)
  fail('VALIDATION', 'No skin file provided')
}

export async function uploadSkin(req: SkinUploadRequest): Promise<void> {
  const account = await getStoredAccount(req.accountId)
  if (!account) fail('NOT_FOUND', 'Account not found')
  if (account.type !== 'microsoft') {
    fail('AUTH', 'Only Microsoft accounts can upload skins to Minecraft')
  }
  const buffer = await resolveUploadBuffer(req)
  validateSkinPng(buffer)
  const token = await getMicrosoftAccessToken(req.accountId)

  const form = new FormData()
  form.append('variant', req.variant === 'slim' ? 'slim' : 'classic')
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'image/png' }), 'skin.png')
  const res = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    fail('AUTH', `Skin upload failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
}

export async function setOfflineSkin(req: SkinOfflineRequest): Promise<void> {
  const account = await getStoredAccount(req.accountId)
  if (!account) fail('NOT_FOUND', 'Account not found')
  if (account.type !== 'offline') {
    fail('VALIDATION', 'Local skins are only available for offline accounts')
  }
  const buffer = await fs.readFile(req.filePath)
  validateSkinPng(buffer)
  const dest = localSkinFile(req.accountId)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, buffer)
}

export async function getSkinForAllAccounts(): Promise<{ accountId: string; info: SkinInfo }[]> {
  const accounts = await listAccounts()
  const out: { accountId: string; info: SkinInfo }[] = []
  for (const account of accounts) {
    try {
      out.push({ accountId: account.id, info: await getSkin(account.id) })
    } catch {
      out.push({ accountId: account.id, info: { model: 'classic' } })
    }
  }
  return out
}
