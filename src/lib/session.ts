/**
 * Session management: stores JWT token + user data securely.
 * Uses sessionStorage for session mode (default) and localStorage for "remember me".
 */
const TOKEN_KEY = 'toabh_session'
const USER_KEY = 'toabh_user'
const REMEMBER_TTL = 2592000 // 30d

export interface SessionUser {
  id: number
  name: string
  email: string
  role: string
  must_reset_password?: boolean
  last_login?: string
  is_active?: number
}

export function saveSession(token: string, user: SessionUser, remember = false) {
  const store = remember ? localStorage : sessionStorage
  const otherStore = remember ? sessionStorage : localStorage
  const data = { token, user, created: Date.now() }
  store.setItem(TOKEN_KEY, JSON.stringify(data))
  store.setItem(USER_KEY, JSON.stringify(user))
  otherStore.removeItem(TOKEN_KEY)
  otherStore.removeItem(USER_KEY)
}

export function getToken(): string | null {
  for (const store of [sessionStorage, localStorage]) {
    const raw = store.getItem(TOKEN_KEY)
    if (!raw) continue
    try {
      const data = JSON.parse(raw)
      if (Date.now() - data.created > REMEMBER_TTL) {
        clearSession()
        continue
      }
      return data.token
    } catch {
      clearSession()
      return null
    }
  }
  return null
}

export function getUser(): SessionUser | null {
  for (const key of [USER_KEY, TOKEN_KEY]) {
    for (const store of [sessionStorage, localStorage]) {
      const raw = store.getItem(key)
      if (!raw) continue
      try {
        const data = JSON.parse(raw)
        if (key === TOKEN_KEY) {
          if (Date.now() - data.created > REMEMBER_TTL) {
            clearSession()
            continue
          }
          return data.user
        }
        return data
      } catch {
        continue
      }
    }
  }
  return null
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function updateStoredUser(user: Partial<SessionUser>) {
  const current = getUser()
  if (current) {
    saveSession(getToken()!, { ...current, ...user } as SessionUser)
  }
}
