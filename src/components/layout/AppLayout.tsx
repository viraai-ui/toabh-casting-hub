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
import type { UserProfile } from '@/types'

export function AppLayout() {
  const { searchOpen, sidebarCollapsed, setCurrentUser } = useAppStore()
  const [checked, setChecked] = useState(false)
  const [castingModalOpen, setCastingModalOpen] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    const sess = getSession()
    if (!sess?.token) {
      setChecked(true)
      return
    }

    // Set token for API calls

    // Load profile
    api.fetch('/profile')
      .then((data: UserProfile) => {
        setCurrentUser({
          name: data.name,
          role: data.role,
          email: data.email,
          phone: data.phone,
          avatar: data.avatar_url,
          date_of_birth: data.date_of_birth,
          team_member_id: data.team_member_id,
        })
        setChecked(true)
      })
      .catch(() => {
        setCurrentUser({ name: sess.user?.name || 'Toaney Bhatia', role: sess.user?.role || 'Admin' })
        setChecked(true)
      })
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

  if (!checked) {
    return null
  }

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
