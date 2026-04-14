import { emitDataRefresh } from '@/hooks/useDataRefresh'

const BASE = import.meta.env.VITE_API_URL || ''
const AUTH_DISABLED = false

interface SessionUser {
  id: number
  name: string
  email: string
  role: string
  must_reset_password?: boolean
}

interface StoredSession {
  token?: string
  user?: SessionUser
  ts?: number
}

export function toApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${BASE}${path}`
}

function getStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
    return raw ? JSON.parse(raw) as StoredSession : null
  } catch {
    return null
  }
}

function safeSetItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Some in-app browsers can block or intermittently fail storage writes.
  }
}

function safeRemoveItem(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // ignore storage cleanup failures
  }
}

function persistSession(data: { token?: string; user?: SessionUser }, remember = false) {
  const payload = JSON.stringify({ token: data.token, user: data.user, ts: Date.now() })
  const preferred = remember ? localStorage : sessionStorage
  safeSetItem(preferred, 'toabh_session', payload)
  if (data.user) {
    safeSetItem(localStorage, 'toabh_user', JSON.stringify(data.user))
    safeSetItem(sessionStorage, 'toabh_user', JSON.stringify(data.user))
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const stored = getStoredSession()
  if (stored?.token) headers.Authorization = `Bearer ${stored.token}`
  return headers
}

function normalizeFetchError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : ''
  if (!message || message === 'Failed to fetch') {
    return `${fallback}. Please refresh once and try again.`
  }
  return message
}

async function parseErrorResponse(r: Response, fallback: string) {
  const text = await r.text()
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text)
    return parsed.error || parsed.message || fallback
  } catch {
    return text || fallback
  }
}

async function request(method: string, path: string, body?: object) {
  const headers = await getAuthHeaders()
  const opts: RequestInit = { method, headers, credentials: 'include' }
  if (body) opts.body = JSON.stringify(body)

  let r: Response
  try {
    r = await fetch(toApiUrl(`/api${path}`), opts)
  } catch (err) {
    throw new Error(normalizeFetchError(err, 'Could not reach the server'))
  }

  if (!r.ok) {
    const message = await parseErrorResponse(r, `HTTP ${r.status}`)
    if (r.status === 401 && path !== '/auth/login') {
      clearSession()
      window.location.href = '/login'
    }
    throw new Error(message)
  }

  const text = await r.text()
  const parsed = !text ? null : (() => {
    try { return JSON.parse(text) } catch { return text }
  })()

  if (method !== 'GET') {
    emitDataRefresh(path)
  }

  return parsed
}

async function upload(path: string, formData: FormData) {
  const headers: Record<string, string> = {}
  const stored = getStoredSession()
  if (stored?.token) headers.Authorization = `Bearer ${stored.token}`

  let r: Response
  try {
    r = await fetch(toApiUrl(`/api${path}`), { method: 'POST', headers, body: formData, credentials: 'include' })
  } catch (err) {
    throw new Error(normalizeFetchError(err, 'Upload failed'))
  }

  if (!r.ok) {
    throw new Error(await parseErrorResponse(r, `HTTP ${r.status}`))
  }

  const text = await r.text()
  const parsed = !text ? null : JSON.parse(text)
  emitDataRefresh(path)
  return parsed
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: object) => request('POST', path, body),
  upload,
  put: (path: string, body: object) => request('PUT', path, body),
  del: (path: string) => request('DELETE', path),
}

export function isLoggedIn(): boolean {
  if (AUTH_DISABLED) return true
  const raw = getStoredSession()
  return Boolean(raw?.ts && Date.now() - raw.ts < 30 * 24 * 60 * 60 * 1000)
}

export async function checkSession(): Promise<boolean> {
  if (AUTH_DISABLED) return true

  const stored = getStoredSession()
  const headers = stored?.token ? { Authorization: `Bearer ${stored.token}` } : undefined

  try {
    const r = await fetch(toApiUrl('/api/auth/me'), { credentials: 'include', headers })
    if (!r.ok) {
      clearSession()
      return false
    }
    const user = await r.json()
    persistSession({ token: stored?.token, user }, Boolean(localStorage.getItem('toabh_session')))
    return true
  } catch {
    clearSession()
    return false
  }
}

export function getSessionUser() {
  try {
    const raw = sessionStorage.getItem('toabh_user') || localStorage.getItem('toabh_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function isAdminUser(user: SessionUser | null | undefined) {
  return String(user?.role || '').toLowerCase() === 'administrator'
}

export function clearSession() {
  if (AUTH_DISABLED) return
  safeRemoveItem(sessionStorage, 'toabh_session')
  safeRemoveItem(localStorage, 'toabh_session')
  safeRemoveItem(sessionStorage, 'toabh_user')
  safeRemoveItem(localStorage, 'toabh_user')
}

export async function login(identifier: string, password: string, remember = false) {
  let r: Response
  try {
    r = await fetch(toApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password, remember }),
      credentials: 'include',
    })
  } catch (err) {
    throw new Error(normalizeFetchError(err, 'Login request failed'))
  }

  if (!r.ok) {
    throw new Error(await parseErrorResponse(r, 'Login failed'))
  }

  const data = await r.json()
  persistSession({ token: data.token, user: data.user }, remember)
  emitDataRefresh('/auth/login')
  return data
}

export async function logout() {
  if (AUTH_DISABLED) return
  try {
    const stored = getStoredSession()
    await fetch(toApiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: stored?.token ? { Authorization: `Bearer ${stored.token}` } : undefined,
      credentials: 'include',
    })
  } catch { /* ignore */ }
  clearSession()
  emitDataRefresh('/auth/logout')
}

export async function forgotPassword(email: string) {
  const r = await fetch(toApiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    credentials: 'include',
  })
  return r.json()
}

export async function resetPassword(token: string, password: string) {
  const r = await fetch(toApiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
    credentials: 'include',
  })
  if (!r.ok) {
    let errMsg = 'Reset failed'
    try { const j = await r.json(); errMsg = j.error || j.message || errMsg } catch {/* */}
    throw new Error(errMsg)
  }
  return r.json()
}
