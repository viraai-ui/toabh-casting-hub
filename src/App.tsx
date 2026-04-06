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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null) // null = checking

  useEffect(() => {
    let cancelled = false
    checkSession().then((ok: boolean) => {
      if (!cancelled) setAuthorized(ok)
    })
    return () => { cancelled = true }
  }, [])

  if (authorized === null) {
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<LoginPage />} />
            <Route path="/forgot-password" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/castings"
                element={
                  <ErrorBoundary>
                    <Castings />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/clients"
                element={
                  <ErrorBoundary>
                    <Clients />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ErrorBoundary>
                    <Calendar />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/team"
                element={
                  <ErrorBoundary>
                    <Team />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/activity"
                element={
                  <ErrorBoundary>
                    <ActivityLog />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/reports"
                element={
                  <ErrorBoundary>
                    <Reports />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/settings"
                element={
                  <ErrorBoundary>
                    <Settings />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/profile"
                element={
                  <ErrorBoundary>
                    <Profile />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ErrorBoundary>
                    <Tasks />
                  </ErrorBoundary>
                }
              />
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
