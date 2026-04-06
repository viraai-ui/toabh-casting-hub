const BASE = import.meta.env.VITE_API_URL || ''

let authToken: string | null = null

// Manually set JWT token (from login response)
export function setJwtToken(token: string) {
  authToken = token
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = authToken || (() => {
    for (const store of [sessionStorage, localStorage]) {
      const raw = store.getItem('toabh_session')
      if (raw) {
        try { return JSON.parse(raw).token as string } catch { /* */ }
      }
    }
    return null
  })()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    authToken = token // cache it
  }
  return headers
}

export function toApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  return `${BASE}${path}`
}

async function request(method: string, path: string, body?: object) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // Attach JWT token if available
    const sess = (function () {
      try {
        const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    })()
    if (sess?.token) headers['Authorization'] = `Bearer ${sess.token}`

    const opts: RequestInit = { method, headers }
    if (body) opts.body = JSON.stringify(body)
    const r = await fetch(toApiUrl(`/api${path}`), opts)
    if (!r.ok) {
      const text = await r.text()
      if (r.status === 401 && path !== '/auth/login') {
        // Session expired
        sessionStorage.removeItem('toabh_session')
        localStorage.removeItem('toabh_session')
        window.location.href = '/login'
      }
      console.error(`[API ${method} ${path}] HTTP ${r.status}:`, text)
      throw new Error(`HTTP ${r.status}`)
    }
    const text = await r.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch (err) {
    console.error(`[API ERROR] ${method} ${path}:`, err)
    throw err
  }
}

// Login helper — sets session on success
async function login(endpoint: string, password: string, remember = false) {
  try {
    const r = await fetch(toApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: endpoint, password, remember }),
    })
    if (!r.ok) {
      const text = await r.text()
      let errMsg = 'Login failed'
      try { const j = JSON.parse(text); errMsg = j.error || j.message || errMsg } catch { /* */ }
      throw new Error(errMsg)
    }
    const data = await r.json()
    const store = remember ? localStorage : sessionStorage
    store.setItem('toabh_session', JSON.stringify({ token: data.token, user: data.user, ts: Date.now() }))
    sessionStorage.setItem('toabh_user', JSON.stringify(data.user))
    return data
  } catch (err: any) {
    throw new Error(err.message || 'Login failed')
  }
}

async function logout() {
  try {
    const sess = (function () {
      try {
        const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    })()
    if (sess?.token) {
      await fetch(toApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sess.token}` },
      })
    }
  } catch { /* ignore */ }
  sessionStorage.removeItem('toabh_session')
  localStorage.removeItem('toabh_session')
  sessionStorage.removeItem('toabh_user')
  localStorage.removeItem('toabh_user')
}

async function upload(path: string, formData: FormData) {
  try {
    const r = await fetch(toApiUrl(`/api${path}`), {
      method: 'POST',
      body: formData,
    })
    if (!r.ok) {
      const text = await r.text()
      console.error(`[API POST ${path}] HTTP ${r.status}:`, text)
      throw new Error(`HTTP ${r.status}`)
    }
    const text = await r.text()
    if (!text) return null
    return JSON.parse(text)
  } catch (err) {
    console.error(`[API ERROR] POST ${path}:`, err)
    throw err
  }
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: object) => request('POST', path, body),
  upload,
  put: (path: string, body: object) => request('PUT', path, body),
  del: (path: string) => request('DELETE', path),
}

// ─── Auth helpers ────────────────────────────────────────────────────────

export function isLoggedIn(): boolean {
  try {
    const sess = (function () {
      try {
        const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    })()
    const ttl = 30 * 24 * 60 * 60 * 1000
    return (Date.now() - sess.ts) < ttl
  } catch {
    return false
  }
}

export async function login(identifier: string, password: string, remember = false) {
  const r = await fetch(toApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, remember }),
  })
  if (!r.ok) {
    const text = await r.text()
    try { const j = JSON.parse(text); throw new Error(j.error || j.message || 'Login failed') } catch { throw new Error('Login failed') }
  }
  const data = await r.json()
  const store = remember ? localStorage : sessionStorage
  store.setItem('toabh_session', JSON.stringify({ token: data.token, user: data.user, ts: Date.now() }))
  return data
}

export async function logout() {
  try {
    const sess = (function () {
      try {
        const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    })()
    if (sess?.token) {
      await fetch(toApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sess.token}` },
      })
    }
  } catch {/* */}
  sessionStorage.removeItem('toabh_session')
  localStorage.removeItem('toabh_session')
}

export function clearSession() {
  sessionStorage.removeItem('toabh_session')
  localStorage.removeItem('toabh_session')
}
  logout,
  setJwtToken: (_token: string) => {},
}

export function isLoggedIn(): boolean {
  try {
    const raw = sessionStorage.getItem('toabh_session') || localStorage.getItem('toabh_session')
    if (!raw) return false
    const { ts } = JSON.parse(raw)
    return Date.now() - ts < 30 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function getSessionUser() {
  try {
    const raw = sessionStorage.getItem('toabh_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem('toabh_session')
  localStorage.removeItem('toabh_session')
  sessionStorage.removeItem('toabh_user')
  localStorage.removeItem('toabh_user')
}

export function setJwtToken(_token: string) { /* no-op, session handled by login() */ }
