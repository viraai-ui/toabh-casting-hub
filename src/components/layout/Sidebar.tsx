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
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { isAdminUser, logout, toApiUrl } from '@/lib/api'

const navSections = [
  {
    label: 'Run the day',
    items: [
      { icon: LayoutDashboard, label: 'Today', path: '/dashboard', hint: 'Urgency and next actions' },
      { icon: Briefcase, label: 'Jobs', path: '/castings', hint: 'Live casting workflow' },
      { icon: Calendar, label: 'Calendar', path: '/calendar', hint: 'Schedule and planning' },
      { icon: CheckSquare, label: 'Tasks', path: '/tasks', hint: 'Personal and team follow-ups' },
      { icon: Activity, label: 'Inbox', path: '/activity', hint: 'Recent movement and handoffs' },
    ],
  },
  {
    label: 'Core records',
    items: [
      { icon: Star, label: 'Talents', path: '/talents', hint: 'Roster and discovery' },
      { icon: Users, label: 'Clients', path: '/clients', hint: 'Relationships and accounts' },
      { icon: UserCircle, label: 'Team', path: '/team', hint: 'Ownership and access' },
      { icon: BarChart3, label: 'Reports', path: '/reports', hint: 'Performance visibility' },
      { icon: Settings, label: 'Settings', path: '/settings', hint: 'Admin controls' },
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

  const allVisibleItems = visibleSections.flatMap((section) => section.items)
  const activeItem = allVisibleItems.find((item) =>
    location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
  )

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AnimatePresence>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/20 glass transition-all duration-300 lg:flex',
          sidebarCollapsed ? 'w-[84px]' : 'w-[280px]'
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-white/10 px-4', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
            <span className="text-lg font-bold text-white">T</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="block font-semibold text-slate-900">TOABH</span>
                <span className="block text-xs text-slate-500">Agency OS</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                <Sparkles className="h-3 w-3" />
                Focused
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {!sidebarCollapsed && activeItem && (
            <div className="mb-4 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3.5 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700/80">Current area</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{activeItem.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{activeItem.hint}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-600" />
              </div>
            </div>
          )}

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
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'w-full rounded-2xl transition-all duration-200',
                        sidebarCollapsed ? 'px-0 py-2.5' : 'px-3 py-2.5',
                        isActive
                          ? 'bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.14)]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
                        <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-amber-600')} />
                        {!sidebarCollapsed && (
                          <div className="min-w-0 text-left">
                            <span className={cn('block text-sm font-medium', isActive && 'font-semibold')}>{item.label}</span>
                            <span className="block truncate text-xs text-slate-400">{item.hint}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="space-y-3 border-t border-white/10 p-3">
          {!sidebarCollapsed && (
            <div className="rounded-2xl border border-slate-200/80 bg-white/75 px-3 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Navigation mode</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Desktop stays optimized for scanning and handoffs.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Daily movement sits first, while talent, clients, reports, and admin tools stay grouped below.</p>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {!sidebarCollapsed && <span className="text-sm font-medium">Collapse rail</span>}
          </button>

          <div className={cn('flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-3', sidebarCollapsed && 'justify-center')}>
            {currentUser?.avatar ? (
              <img
                src={toApiUrl(currentUser.avatar)}
                alt={currentUser.name}
                className="h-9 w-9 rounded-full bg-slate-100 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-medium text-white">
                {currentUser ? getInitials(currentUser.name) : 'TB'}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {currentUser?.name || 'Team Member'}
                </p>
                <p className="text-xs text-slate-500">{currentUser?.role || 'Admin'}</p>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          )}
        </div>
      </aside>
    </AnimatePresence>
  )
}
