import { Outlet } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { GlobalSearch } from '@/components/GlobalSearch'
import { OverlayProvider } from '@/hooks/useOverlayManager'
import { useAppStore } from '@/hooks/useStore'
import { cn } from '@/lib/utils'
import { CastingAssistant } from '@/components/assistant/CastingAssistant'
import { CastingModal } from '@/components/CastingModal'
import { api, getSession } from '@/lib/auth'

export function AppLayout() {
  const { searchOpen, sidebarCollapsed, setCurrentUser } = useAppStore()
  const [castingModalOpen, setCastingModalOpen] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    const session = getSession()
    if (!session) {
      setCurrentUser(null)
      return
    }

    setCurrentUser(session.user)
    void api.fetch('/auth/me')
      .then((user) => {
        if (user && typeof user === 'object') {
          setCurrentUser(user as typeof session.user)
        }
      })
      .catch(() => {
        setCurrentUser(session.user)
      })
      .finally(() => undefined)
  }, [setCurrentUser])

  // Listen for global "open casting modal" events (from FAB, toolbar, dashboard)
  useEffect(() => {
    const handler = (e: Event) => {
      if (e instanceof CustomEvent && e.detail?.action === 'open-casting-modal') {
        setCastingModalOpen(true)
      }
    }
    window.addEventListener('toabh-global-action', handler)
    return () => window.removeEventListener('toabh-global-action', handler)
  }, [])

  const handleCastingSaved = useCallback(() => {
    window.dispatchEvent(new CustomEvent('toabh-data-refresh'))
  }, [])

  return (
    <OverlayProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <BottomNav />
        <Header />

        {/* Main content area */}
        <main
          className={cn(
            'pt-16 pb-20 lg:pb-6 min-h-screen transition-all duration-300',
            sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
          )}
        >
          <div className="p-4 lg:px-6 lg:pt-6 lg:pb-10 lg:pr-32 xl:pr-36">
            <Outlet />
          </div>
        </main>

        {/* Global Search Modal */}
        {searchOpen && <GlobalSearch />}
        <CastingAssistant />

        {/* Global Casting Modal — accessible from anywhere via event */}
        <CastingModal
          open={castingModalOpen}
          onClose={() => setCastingModalOpen(false)}
          casting={null}
          onSave={handleCastingSaved}
        />
      </div>
    </OverlayProvider>
  )
}
