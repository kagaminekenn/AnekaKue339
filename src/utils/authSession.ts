const SESSION_STORAGE_KEY = 'anekakue339.auth.session'
const SESSION_DURATION_MS = 30 * 60 * 1000

interface UserInfo {
  id: string
  email: string | null
  displayName?: string | null
}

export interface AuthSessionPayload {
  accessToken: string
  refreshToken: string
  user: UserInfo
  expiresAt: number
}

interface EncryptedSession {
  iv: string
  data: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getSecretValue() {
  return import.meta.env.VITE_SESSION_ENCRYPTION_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'aneka-kue-339-session-secret'
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

function fromBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getCryptoKey() {
  const hashedSecret = await crypto.subtle.digest('SHA-256', encoder.encode(getSecretValue()))
  return crypto.subtle.importKey('raw', hashedSecret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptPayload(payload: AuthSessionPayload) {
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plainText = encoder.encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainText)

  return {
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  } satisfies EncryptedSession
}

async function decryptPayload(encryptedSession: EncryptedSession) {
  const key = await getCryptoKey()
  const iv = fromBase64(encryptedSession.iv)
  const data = fromBase64(encryptedSession.data)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(decoder.decode(decrypted)) as AuthSessionPayload
}

export async function saveEncryptedSession(input: Omit<AuthSessionPayload, 'expiresAt'>) {
  const payload: AuthSessionPayload = {
    ...input,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }

  const encrypted = await encryptPayload(payload)
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(encrypted))
  return payload
}

export async function touchEncryptedSession() {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const encrypted = JSON.parse(raw) as EncryptedSession
    const payload = await decryptPayload(encrypted)

    if (payload.expiresAt <= Date.now()) {
      clearEncryptedSession()
      return null
    }

    const refreshedPayload: AuthSessionPayload = {
      ...payload,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    }

    const refreshedEncrypted = await encryptPayload(refreshedPayload)
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshedEncrypted))
    return refreshedPayload
  } catch {
    clearEncryptedSession()
    return null
  }
}

export async function loadEncryptedSession() {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const encrypted = JSON.parse(raw) as EncryptedSession
    const payload = await decryptPayload(encrypted)
    if (payload.expiresAt <= Date.now()) {
      clearEncryptedSession()
      return null
    }
    return payload
  } catch {
    clearEncryptedSession()
    return null
  }
}

export function clearEncryptedSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

export const SESSION_MAX_AGE_MS = SESSION_DURATION_MS
