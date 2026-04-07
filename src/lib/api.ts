const BASE = import.meta.env.VITE_API_URL || ''
// AUTH TEMPORARILY DISABLED — set to false to re-enable
const AUTH_DISABLED = true

export function toApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${BASE}${path}`
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
    if (raw) {
      const { token } = JSON.parse(raw)
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
  } catch {/* */}
  return headers
}

async function request(method: string, path: string, body?: object) {
  const headers = await getAuthHeaders()
  const opts: RequestInit = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const r = await fetch(toApiUrl(`/api${path}`), opts)
  if (!r.ok) {
    const text = await r.text()
    if (r.status === 401 && path !== '/auth/login') {
      clearSession()
      window.location.href = '/login'
    }
    if (text) throw new Error(JSON.parse(text).error || text)
    throw new Error(`HTTP ${r.status}`)
  }
  const text = await r.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

async function upload(path: string, formData: FormData) {
  const headers: Record<string, string> = {}
  try {
    const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
    if (raw) {
      const { token } = JSON.parse(raw)
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
  } catch {/* */}
  const r = await fetch(toApiUrl(`/api${path}`), { method: 'POST', headers, body: formData })
  if (!r.ok) {
    const text = await r.text()
    if (text) throw new Error(JSON.parse(text).error || text)
    throw new Error(`HTTP ${r.status}`)
  }
  const text = await r.text()
  if (!text) return null
  return JSON.parse(text)
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
  try {
    const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
    if (!raw) return false
    const { ts } = JSON.parse(raw)
    return Date.now() - ts < 30 * 24 * 60 * 60 * 1000
  } catch { return false }
}

export function checkSession(): Promise<boolean> {
  return Promise.resolve(isLoggedIn())
}

export function getSessionUser() {
  try {
    const raw = sessionStorage.getItem('toabh_user') || localStorage.getItem('toabh_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearSession() {
  if (AUTH_DISABLED) return
  sessionStorage.removeItem('toabh_session')
  localStorage.removeItem('toabh_session')
  sessionStorage.removeItem('toabh_user')
  localStorage.removeItem('toabh_user')
}

export async function login(identifier: string, password: string, remember = false) {
  const r = await fetch(toApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password, remember }),
  })
  if (!r.ok) {
    let errMsg = 'Login failed'
    try { const j = await r.json(); errMsg = j.error || j.message || errMsg } catch {/* */}
    throw new Error(errMsg)
  }
  const data = await r.json()
  const store = remember ? localStorage : sessionStorage
  store.setItem('toabh_session', JSON.stringify({ token: data.token, user: data.user, ts: Date.now() }))
  localStorage.setItem('toabh_user', JSON.stringify(data.user))
  sessionStorage.setItem('toabh_user', JSON.stringify(data.user))
  return data
}

export async function logout() {
  if (AUTH_DISABLED) return
  try {
    const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
    if (raw) {
      const { token } = JSON.parse(raw)
      if (token) {
        await fetch(toApiUrl('/api/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      }
    }
  } catch { /* ignore */ }
  clearSession()
}

export async function forgotPassword(email: string) {
  const r = await fetch(toApiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return r.json()
}

export async function resetPassword(token: string, password: string) {
  const r = await fetch(toApiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  if (!r.ok) {
    let errMsg = 'Reset failed'
    try { const j = await r.json(); errMsg = j.error || j.message || errMsg } catch {/* */}
    throw new Error(errMsg)
  }
  return r.json()
}
