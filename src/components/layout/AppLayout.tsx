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
import { api, getSessionUser } from '@/lib/api'
import { emitDataRefresh } from '@/hooks/useDataRefresh'

export function AppLayout() {
  const { searchOpen, sidebarCollapsed, setCurrentUser } = useAppStore()
  const [castingModalOpen, setCastingModalOpen] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    const sessionUser = getSessionUser()
    if (!sessionUser) {
      setCurrentUser(null)
      return
    }

    setCurrentUser(sessionUser)
    void api.get('/auth/me')
      .then((user) => {
        if (user && typeof user === 'object') {
          setCurrentUser(user as typeof sessionUser)
        }
      })
      .catch(() => {
        setCurrentUser(sessionUser)
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
    emitDataRefresh('casting-saved')
  }, [])

  return (
    <OverlayProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),_transparent_28%),linear-gradient(180deg,_#fffdf8_0%,_#ffffff_22%,_#f8fafc_100%)]">
        <Sidebar />
        <BottomNav />
        <Header />

        {/* Main content area */}
        <main
          className={cn(
            'min-h-screen pb-24 pt-16 transition-all duration-300 lg:pb-8',
            sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
          )}
        >
          <div className="px-3 pb-10 pt-4 sm:px-4 lg:px-6 lg:pt-6 lg:pr-20 xl:pr-24">
            <div className="mx-auto w-full max-w-[1560px]">
              <div className="rounded-[28px] border border-white/50 bg-white/35 p-1.5 shadow-[0_16px_48px_rgba(15,23,42,0.04)] backdrop-blur-[1px] sm:p-2 lg:p-2.5">
                <Outlet />
              </div>
            </div>
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
