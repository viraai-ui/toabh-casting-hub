import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { Castings } from './pages/Castings'
import { Clients } from './pages/Clients'
import { Calendar } from './pages/Calendar'
import { Team } from './pages/Team'
import { ActivityLog } from './pages/ActivityLog'
import { Tasks } from './pages/Tasks'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'
import { ErrorBoundary } from './components/ErrorBoundary'
import { checkSession } from './lib/api'

// AUTH TEMPORARILY DISABLED — set to true to enable auth back
const AUTH_DISABLED = true

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // When auth is disabled, always render children without session check
  if (AUTH_DISABLED) return <>{children}</>

  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    checkSession().then((ok: boolean) => {
      if (!cancelled) { setAuthorized(ok); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function AuthDisabledGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const navigate = useState<any>()[0] // dummy, we'll use window.location instead
  
  useEffect(() => {
    if (!AUTH_DISABLED) { setReady(true); return }
    // Ensure session exists, then redirect to dashboard
    try {
      const fakeToken = btoa(JSON.stringify({ sub: 0, email: 'admin@toabh.com', role: 'admin', sa: true, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400 })) + '.disabled'
      const session = { token: fakeToken, user: { id: 0, email: 'admin@toabh.com', role: 'admin', name: 'Administrator' }, ts: Date.now() }
      sessionStorage.setItem('toabh_session', JSON.stringify(session))
      localStorage.setItem('toabh_session', JSON.stringify(session))
      localStorage.setItem('toabh_user', JSON.stringify(session.user))
    } catch {}
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Auth disabled: skip login page entirely */}
            {!AUTH_DISABLED && (
              <>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<LoginPage />} />
                <Route path="/forgot-password" element={<LoginPage />} />
              </>
            )}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/castings" element={<ErrorBoundary><Castings /></ErrorBoundary>} />
              <Route path="/clients" element={<ErrorBoundary><Clients /></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
              <Route path="/team" element={<ErrorBoundary><Team /></ErrorBoundary>} />
              <Route path="/activity" element={<ErrorBoundary><ActivityLog /></ErrorBoundary>} />
              <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
              <Route path="/tasks" element={<ErrorBoundary><Tasks /></ErrorBoundary>} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
