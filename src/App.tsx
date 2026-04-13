import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { checkSession } from './lib/api'
import { LoginPage } from './pages/LoginPage'

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const Castings = lazy(() => import('./pages/Castings').then((module) => ({ default: module.Castings })))
const Clients = lazy(() => import('./pages/Clients').then((module) => ({ default: module.Clients })))
const Calendar = lazy(() => import('./pages/Calendar').then((module) => ({ default: module.Calendar })))
const Team = lazy(() => import('./pages/Team').then((module) => ({ default: module.Team })))
const ActivityLog = lazy(() => import('./pages/ActivityLog').then((module) => ({ default: module.ActivityLog })))
const Tasks = lazy(() => import('./pages/Tasks').then((module) => ({ default: module.Tasks })))
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })))
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))
const Talents = lazy(() => import('./pages/Talents').then((module) => ({ default: module.Talents })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, retry: 1 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    checkSession().then((ok) => {
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

function RouteLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-transparent">
      <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
    </div>
  )
}

function RouteElement({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<RouteElement><Dashboard /></RouteElement>} />
              <Route path="/castings" element={<RouteElement><Castings /></RouteElement>} />
              <Route path="/clients" element={<RouteElement><Clients /></RouteElement>} />
              <Route path="/calendar" element={<RouteElement><Calendar /></RouteElement>} />
              <Route path="/team" element={<RouteElement><Team /></RouteElement>} />
              <Route path="/talents" element={<RouteElement><Talents /></RouteElement>} />
              <Route path="/activity" element={<RouteElement><ActivityLog /></RouteElement>} />
              <Route path="/reports" element={<RouteElement><Reports /></RouteElement>} />
              <Route path="/settings" element={<RouteElement><Settings /></RouteElement>} />
              <Route path="/profile" element={<RouteElement><Profile /></RouteElement>} />
              <Route path="/tasks" element={<RouteElement><Tasks /></RouteElement>} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<LoginPage />} />
            <Route path="/forgot-password" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
