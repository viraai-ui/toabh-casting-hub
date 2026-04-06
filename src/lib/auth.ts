const TOKEN_NAME = 'toabh_session'
const REMEMBER_ME_NAME = 'toabh_remember'
const SESSION_TTL = 24 * 60 * 60 * 1000       // 1 day (session)
const REMEMBER_TTL = 30 * 24 * 60 * 60 * 1000  // 30 days (remember me)

// Simple token: base64(payload).signature using a client-side secret
// This is sufficient for a single-admin app (not multi-user)
function getSecret(): string {
  return import.meta.env.VITE_AUTH_SECRET || 'toabh-auth-secret-2026'
}

async function hmacSha256(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createSession(remember: boolean): Promise<string> {
  const now = Date.now()
  const ttl = remember ? REMEMBER_TTL : SESSION_TTL
  const payload = {
    v: true,                        // verified
    t: now,                         // issued at
    e: now + ttl,                   // expires
    r: remember,                    // remember me flag
  }
  const payloadB64 = btoa(JSON.stringify(payload))
  const sig = await hmacSha256(payloadB64, getSecret())
  return `${payloadB64}.${sig}`
}

export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false
  try {
    const [payloadB64, sig] = token.split('.')
    if (!payloadB64 || !sig) return false

    // Verify signature
    const expectedSig = await hmacSha256(payloadB64, getSecret())
    if (sig !== expectedSig) return false

    // Check expiry
    const payload = JSON.parse(atob(payloadB64))
    if (!payload.v || Date.now() > payload.e) return false

    return true
  } catch {
    return false
  }
}

// Cookie helpers
function setCookie(name: string, value: string, maxAgeMs?: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    'SameSite=Lax',
  ]
  if (maxAgeMs !== undefined) {
    parts.push(`max-age=${Math.floor(maxAgeMs / 1000)}`)
  }
  document.cookie = parts.join('; ')
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

export async function loginAndSetSession(remember: boolean): Promise<boolean> {
  const token = await createSession(remember)
  if (remember) {
    setCookie(TOKEN_NAME, token, REMEMBER_TTL)
    setCookie(REMEMBER_ME_NAME, '1', REMEMBER_TTL)
  } else {
    // Session cookie (expires when browser closes)
    setCookie(TOKEN_NAME, token)
    deleteCookie(REMEMBER_ME_NAME)
  }
  return true
}

export async function checkSession(): Promise<boolean> {
  const token = getCookie(TOKEN_NAME)
  if (!token) return false
  const valid = await verifySession(token)
  if (!valid) {
    logout()
    return false
  }
  return true
}

export function isRememberMe(): boolean {
  return getCookie(REMEMBER_ME_NAME) === '1'
}

export function logout() {
  deleteCookie(TOKEN_NAME)
  deleteCookie(REMEMBER_ME_NAME)
  sessionStorage.removeItem('admin_verified')
}
