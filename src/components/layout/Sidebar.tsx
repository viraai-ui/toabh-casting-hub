import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Users,
  Calendar,
  UserCircle,
  Activity,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Star,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { isAdminUser, logout, toApiUrl } from '@/lib/api'

const navSections = [
  {
    label: 'Run the day',
    items: [
      { icon: LayoutDashboard, label: 'Today', path: '/dashboard' },
      { icon: Briefcase, label: 'Jobs', path: '/castings' },
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
      { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
      { icon: Activity, label: 'Inbox', path: '/activity' },
    ],
  },
  {
    label: 'Core records',
    items: [
      { icon: Star, label: 'Talents', path: '/talents' },
      { icon: Users, label: 'Clients', path: '/clients' },
      { icon: UserCircle, label: 'Team', path: '/team' },
      { icon: BarChart3, label: 'Reports', path: '/reports' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar, currentUser } = useAppStore()
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.path !== '/settings' || isAdminUser(currentUser)),
    }))
    .filter((section) => section.items.length > 0)

  const handleLogout = () => {
    logout()
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
              <span className="text-xs text-slate-500">Agency OS</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-4">
            {visibleSections.map((section) => (
              <div key={section.label} className="space-y-1.5">
                {!sidebarCollapsed && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {section.label}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path || 
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200',
                        isActive
                          ? 'bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.14)]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        sidebarCollapsed && 'justify-center px-0'
                      )}
                    >
                      <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-amber-600')} />
                      {!sidebarCollapsed && <span className={cn('font-medium', isActive && 'font-semibold')}>{item.label}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 p-3 space-y-3">
          {!sidebarCollapsed && (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700/80">Navigation mode</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Planning on desktop, execution on mobile.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Today, Jobs, Calendar, Tasks, and Inbox stay closest to the top for daily movement.</p>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span className="text-sm font-medium">Collapse</span>}
          </button>

          {/* User */}
          <div className={cn('flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-3', sidebarCollapsed && 'justify-center')}>
            {currentUser?.avatar ? (
              <img
                src={toApiUrl(currentUser.avatar)}
                alt={currentUser.name}
                className="h-9 w-9 rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-medium">
                {currentUser ? getInitials(currentUser.name) : 'TB'}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {currentUser?.name || 'Team Member'}
                </p>
                <p className="text-xs text-slate-500">{currentUser?.role || 'Admin'}</p>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          )}
        </div>
      </aside>
    </AnimatePresence>
  )
}
