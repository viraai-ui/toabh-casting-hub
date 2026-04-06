import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { getSessionUser, clearSession } from '@/lib/session'

interface User {
  id: number
  name: string
  email: string
  role: string
  must_reset_password?: boolean
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  hasPermission: (page: string) => boolean
  login: (identifier: string, password: string, remember?: boolean) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Page → permission key mapping
const PAGE_PERMS: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/castings': 'jobs',
  '/clients': 'clients',
  '/calendar': 'calendar',
  '/team': 'team',
  '/tasks': 'tasks',
  '/reports': 'reports',
  '/settings': 'settings',
  '/activity': 'activity',
  '/profile': 'profile',
}

async function fetchPermissions(role: string): Promise<Record<string, number>> {
  try {
    const data = await api.get('/settings/permissions') as Record<string, Record<string, number>>
    return data[role] || data['admin'] || {}
  } catch {
    return { dashboard: 1, calendar: 1, tasks: 1, profile: 1 }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<Record<string, number>>({})
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    (async () => {
      const sess = getSession()
      if (!sessionStorage.getItem("toabh_session")) {
        setLoading(false)
        return
      }

      try {
        // Set token for all API calls
        const userData = await api.get('/auth/me') as User
        setUser(userData)
        const perms = await fetchPermissions(userData.role)
        setPermissions(perms)

        // Store user in session
        const s = getSession()
        if (s) setSession(s.token, userData)
      } catch {
        clearSession()
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Redirect unauthorized users
  useEffect(() => {
    if (!loading && !user) {
      const path = location.pathname
      if (path !== '/login' && path !== '/reset-password' && path !== '/forgot-password') {
        navigate('/login', { replace: true })
      }
    }
    // Check page-level permission
    if (user && !hasPermission(PAGE_PERMS[location.pathname] || '')) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, user, location.pathname])

  const hasPermission = (page: string): boolean => {
    if (!user) return false
    // Super-admin / admin always has access
    if (user.role === 'admin' || user.role === 'super-admin') return true
    if (!page) return true
    return (permissions[page] ?? 0) === 1
  }

  const login = async (identifier: string, password: string, remember = false) => {
    const result = await api.post('/auth/login', { username: identifier, password, remember }) as {
      token: string
      user: User
    }
    setSession(result.token, result.user, remember)
    
    setUser(result.user)
    const perms = await fetchPermissions(result.user.role)
    setPermissions(perms)

    if (result.user.must_reset_password) {
      navigate('/change-password', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  const logout = () => {
    clearSession()
    
    setUser(null)
    navigate('/login', { replace: true })
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasPermission, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
