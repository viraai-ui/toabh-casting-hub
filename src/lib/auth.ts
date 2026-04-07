// AUTH TEMPORARILY DISABLED — set to false to re-enable
const AUTH_DISABLED = true

const TOKEN_KEY = 'toabh_session'

export interface User {
  id: number
  email: string
  name: string
  role: string
  must_reset_password?: boolean
}

// When auth is disabled, create a fake session on first access (lazy, not at module load)
function _getOrInitDisabledSession(): { token: string; user: User } | null {
  if (!AUTH_DISABLED) return null
  try {
    for (const store of [sessionStorage, localStorage]) {
      const raw = store.getItem(TOKEN_KEY)
      if (raw) { return JSON.parse(raw) }
    }
    // Create on-the-fly if nothing stored yet
    const user: User = { id: 0, email: 'admin@toabh.com', role: 'admin', name: 'Administrator' }
    const payload = JSON.stringify({ sub: 0, email: 'admin@toabh.com', role: 'admin', sa: true, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })
    const fakeToken = btoa(payload) + '.disabled'
    const session = { token: fakeToken, user, ts: Date.now() }
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session))
    localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
    localStorage.setItem('toabh_user', JSON.stringify(user))
    return session
  } catch {
    return null
  }
}

function _parseToken(token: string) {
  try {
    const [b64] = token.split('.')
    if (!b64) return null
    const padding = 4 - (b64.length % 4)
    const data = b64 + '='.repeat(padding === 4 ? 0 : padding)
    return JSON.parse(atob(data))
  } catch {
    return null
  }
}

export function saveSession(token: string, user: User, remember = false) {
  const store = remember ? localStorage : sessionStorage
  store.setItem(TOKEN_KEY, JSON.stringify({ token, user, ts: Date.now() }))
}

export function getSession(): { token: string; user: User } | null {
  // When auth is disabled, always return an admin session
  if (AUTH_DISABLED) {
    return _getOrInitDisabledSession() ?? { token: 'disabled', user: { id: 0, email: 'admin@toabh.com', role: 'admin', name: 'Administrator' } }
  }

  for (const store of [sessionStorage, localStorage]) {
    const raw = store.getItem(TOKEN_KEY)
    if (!raw) continue
    try {
      const data = JSON.parse(raw)
      const ttl = store === localStorage ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      if (Date.now() - data.ts > ttl) { store.removeItem(TOKEN_KEY); continue }
      const payload = _parseToken(data.token)
      if (!payload || payload.exp < Date.now() / 1000) { store.removeItem(TOKEN_KEY); continue }
      return { token: data.token, user: data.user }
    } catch {
      store.removeItem(TOKEN_KEY)
    }
  }
  return null
}

export function clearSession() {
  if (AUTH_DISABLED) return // never clear disabled session
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  if (AUTH_DISABLED) return true
  return getSession() !== null
}

export const api = {
  async login(identifier: string, password: string, remember = false) {
    if (AUTH_DISABLED) {
      const user: User = { id: 0, email: 'admin@toabh.com', role: 'admin', name: 'Administrator' }
      const payload = JSON.stringify({ sub: 0, email: 'admin@toabh.com', role: 'admin', sa: true, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })
      const fakeToken = btoa(payload) + '.disabled'
      saveSession(fakeToken, user, remember)
      return { token: fakeToken, user }
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password, remember }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }))
      throw new Error(err.error || 'Login failed')
    }
    const data = await res.json()
    saveSession(data.token, data.user, remember)
    return data
  },

  async logout() {
    if (AUTH_DISABLED) return
    try {
      const s = getSession()
      if (s?.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${s.token}` },
        })
      }
    } catch { /* ignore */ }
    clearSession()
  },

  async forgotPassword(email: string) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.json()
  },

  async resetPassword(token: string, password: string) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Reset failed' }))
      throw new Error(err.error || 'Reset failed')
    }
    return res.json()
  },

  async changePassword(current_password: string, new_password: string) {
    if (AUTH_DISABLED) { return { ok: true } }
    const s = getSession()
    if (!s) throw new Error('Not logged in')
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.token}`,
      },
      body: JSON.stringify({ current_password, new_password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed' }))
      throw new Error(err.error || 'Failed')
    }
    return res.json()
  },

  async getPermissions() {
    if (AUTH_DISABLED) { return { admin: { dashboard:1, jobs:1, clients:1, calendar:1, team:1, tasks:1, reports:1, settings:1, activity:1, profile:1 } } }
    const s = getSession()
    if (!s?.token) return {}
    const res = await fetch('/api/settings/permissions', {
      headers: { Authorization: `Bearer ${s.token}` },
    })
    if (!res.ok) return {}
    return res.json()
  },

  async resendInvite(memberId: number) {
    const s = getSession()
    if (!s?.token) throw new Error('Not logged in')
    const res = await fetch(`/api/team/${memberId}/resend-invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.token}` },
    })
    return res.json()
  },

  async toggleMemberStatus(memberId: number) {
    const s = getSession()
    if (!s?.token) throw new Error('Not logged in')
    const res = await fetch(`/api/team/${memberId}/toggle-status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.token}` },
    })
    return res.json()
  },

  async fetch(path: string, opts: RequestInit = {}) {
    const s = getSession()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}),
      ...((opts.headers as Record<string, string>) || {}),
    }
    const res = await fetch(path.startsWith('http') ? path : `/api${path}`, { ...opts, headers })
    if (res.status === 401 && !AUTH_DISABLED) {
      clearSession()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  },
}
