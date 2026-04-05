import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { GlobalSearch } from '@/components/GlobalSearch'
import { OverlayProvider } from '@/hooks/useOverlayManager'
import { useAppStore } from '@/hooks/useStore'
import { cn } from '@/lib/utils'
import { CastingAssistant } from '@/components/assistant/CastingAssistant'
import { api } from '@/lib/api'
import type { UserProfile } from '@/types'

export function AppLayout() {
  const { searchOpen, sidebarCollapsed, setCurrentUser } = useAppStore()

  useEffect(() => {
    api.get('/profile')
      .then((data) => {
        const profile = data as UserProfile
        setCurrentUser({
          name: profile.name,
          role: profile.role,
          email: profile.email,
          phone: profile.phone,
          avatar: profile.avatar_url,
          date_of_birth: profile.date_of_birth,
          team_member_id: profile.team_member_id,
        })
      })
      .catch(() => {
        setCurrentUser({ name: 'Toaney Bhatia', role: 'Admin' })
      })
  }, [setCurrentUser])

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
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        {/* Global Search Modal */}
        {searchOpen && <GlobalSearch />}
        <CastingAssistant />
      </div>
    </OverlayProvider>
  )
}
