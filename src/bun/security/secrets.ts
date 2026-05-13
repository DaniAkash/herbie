import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Key material lives in macOS Keychain. We derive a single AES-256 key
// per machine and reuse it to encrypt all bot tokens (and any future
// secrets) at rest. The DB column stores `v1:<iv-b64>:<tag-b64>:<ct-b64>`.
//
// macOS-only — Herbie ships macOS-only today (see CLAUDE/README). When
// we add other platforms, swap the keychain layer for libsecret /
// DPAPI behind the same interface.
const KEYCHAIN_SERVICE = 'com.daniakash.herbie'
const KEYCHAIN_ACCOUNT = 'tg_secret_key_v1'
const ALGO = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12

let cachedKey: Buffer | null = null

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export async function decryptSecret(payload: string): Promise<string> {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('encrypted payload has unexpected format')
  }
  const [, ivB64, tagB64, ctB64] = parts
  const key = await getOrCreateKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

async function getOrCreateKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey
  const existing = await readKey()
  if (existing) {
    cachedKey = existing
    return existing
  }
  const fresh = randomBytes(KEY_BYTES)
  await writeKey(fresh)
  cachedKey = fresh
  return fresh
}

async function readKey(): Promise<Buffer | null> {
  // `security find-generic-password -w` prints the password (the
  // base64-encoded key) to stdout. Exit code 44 = item not found.
  const { code, stdout } = await runSecurity([
    'find-generic-password',
    '-s',
    KEYCHAIN_SERVICE,
    '-a',
    KEYCHAIN_ACCOUNT,
    '-w',
  ])
  if (code === 44) return null
  if (code !== 0) {
    throw new Error(`security find-generic-password failed (exit ${code})`)
  }
  const trimmed = stdout.trim()
  if (!trimmed) return null
  try {
    const buf = Buffer.from(trimmed, 'base64')
    if (buf.length !== KEY_BYTES) return null
    return buf
  } catch {
    return null
  }
}

async function writeKey(key: Buffer): Promise<void> {
  const { code } = await runSecurity([
    'add-generic-password',
    '-s',
    KEYCHAIN_SERVICE,
    '-a',
    KEYCHAIN_ACCOUNT,
    '-w',
    key.toString('base64'),
    '-U', // update if it already exists — survives a partial first run
  ])
  if (code !== 0) {
    throw new Error(`security add-generic-password failed (exit ${code})`)
  }
}

function runSecurity(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('/usr/bin/security', args, { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}
