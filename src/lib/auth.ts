const TOKEN_KEY = 'toabh_session'

export interface User {
  id: number
  email: string
  name: string
  role: string
  must_reset_password?: boolean
}

function _parseToken(token: string) {
  try {
    const [b64] = token.split('.')
    if (!b64) return null
    const padding = 4 - (b64.length % 4)
    const payload = b64 + '='.repeat(padding === 4 ? 0 : padding)
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function saveSession(token: string, user: User, remember = false) {
  const store = remember ? localStorage : sessionStorage
  store.setItem(TOKEN_KEY, JSON.stringify({ token, user, ts: Date.now() }))
}

export function getSession(): { token: string; user: User } | null {
  for (const store of [sessionStorage, localStorage]) {
    const raw = store.getItem(TOKEN_KEY)
    if (!raw) continue
    try {
      const data = JSON.parse(raw)
      // 24h session, 30d remember
      const ttl = store === localStorage ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      if (Date.now() - data.ts > ttl) {
        store.removeItem(TOKEN_KEY)
        continue
      }
      const payload = _parseToken(data.token)
      if (!payload || payload.exp < Date.now() / 1000) {
        store.removeItem(TOKEN_KEY)
        continue
      }
      return { token: data.token, user: data.user }
    } catch {
      store.removeItem(TOKEN_KEY)
    }
  }
  return null
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return getSession() !== null
}

export const api = {
  async login(identifier: string, password: string, remember = false) {
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
    try {
      const s = getSession()
      if (s?.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${s.token}` },
        })
      }
    } catch {
      // ignore
    }
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

  // Generic authenticated fetch
  async fetch(path: string, opts: RequestInit = {}) {
    const s = getSession()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}),
      ...((opts.headers as Record<string, string>) || {}),
    }
    const res = await fetch(path.startsWith('http') ? path : `/api${path}`, { ...opts, headers })
    if (res.status === 401) {
      clearSession()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  },
}
