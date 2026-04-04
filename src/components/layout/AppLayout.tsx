import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { GlobalSearch } from '@/components/GlobalSearch'
import { OverlayProvider } from '@/hooks/useOverlayManager'
import { useAppStore } from '@/hooks/useStore'
import { cn } from '@/lib/utils'
import { CastingAssistant } from '@/components/assistant/CastingAssistant'

export function AppLayout() {
  const { searchOpen, sidebarCollapsed } = useAppStore()

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
