import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  UserCircle,
  Activity,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Briefcase, label: 'Castings', path: '/castings' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: UserCircle, label: 'Team', path: '/team' },
  { icon: Activity, label: 'Activity', path: '/activity' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar, currentUser } = useAppStore()

  const handleLogout = () => {
    sessionStorage.removeItem('admin_verified')
    navigate('/login')
  }

  return (
    <AnimatePresence>
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen hidden lg:flex flex-col glass border-r border-white/20 transition-all duration-300',
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b border-white/10', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">TOABH</span>
              <span className="text-xs text-slate-500">Casting Hub</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-amber-500/10 text-amber-600 border-l-4 border-amber-500 -ml-1 pl-4'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  sidebarCollapsed && 'justify-center px-0'
                )}
              >
                <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-amber-500')} />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 p-3 space-y-2">
          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>

          {/* User */}
          <div className={cn('flex items-center gap-3 px-3 py-2', sidebarCollapsed && 'justify-center')}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-medium">
              {currentUser ? getInitials(currentUser.name) : 'TB'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {currentUser?.name || 'Toaney Bhatia'}
                </p>
                <p className="text-xs text-slate-500">{currentUser?.role || 'Admin'}</p>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          )}
        </div>
      </aside>
    </AnimatePresence>
  )
}
