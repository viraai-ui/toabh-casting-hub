import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Briefcase,
  Plus,
  Calendar,
  MoreHorizontal,
  X,
  Activity,
  BarChart3,
  Settings,
  LogOut,
  Star,
  Users,
  CheckSquare,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'
import { getSessionUser, isAdminUser, logout } from '@/lib/api'

const mainItems = [
  { icon: LayoutDashboard, label: 'Today', path: '/dashboard', hint: 'Urgency' },
  { icon: Briefcase, label: 'Jobs', path: '/castings', hint: 'Pipeline' },
  { icon: Plus, label: '', path: '', isFab: true },
  { icon: Calendar, label: 'Calendar', path: '/calendar', hint: 'Schedule' },
  { icon: MoreHorizontal, label: 'More', path: '#', hint: 'Records' },
]

const primaryHintMap: Record<string, string> = {
  '/dashboard': 'Urgency',
  '/castings': 'Pipeline',
  '/calendar': 'Schedule',
  '#': 'Records',
}

const moreItems = [
  { icon: Activity, label: 'Inbox', path: '/activity', hint: 'Recent movement' },
  { icon: Star, label: 'Talents', path: '/talents', hint: 'Roster and discovery' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks', hint: 'Action items' },
  { icon: Users, label: 'Clients', path: '/clients', hint: 'Accounts and contacts' },
  { icon: BarChart3, label: 'Reports', path: '/reports', hint: 'Performance view' },
  { icon: Settings, label: 'Settings', path: '/settings', hint: 'Admin controls' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const { openOverlay, closeOverlay } = useOverlay()
  const currentUser = getSessionUser()
  const visibleMoreItems = moreItems.filter((item) => item.path !== '/settings' || isAdminUser(currentUser))
  const [fabMenuOpen, setFabMenuOpen] = useState(false)

  useEffect(() => {
    if (moreOpen) {
      openOverlay('bottom-nav-more-sheet', () => setMoreOpen(false))
    } else {
      closeOverlay('bottom-nav-more-sheet')
    }
  }, [moreOpen, openOverlay, closeOverlay])

  useEffect(() => {
    if (fabMenuOpen) {
      openOverlay('fab-menu', () => setFabMenuOpen(false))
    } else {
      closeOverlay('fab-menu')
    }
  }, [fabMenuOpen, openOverlay, closeOverlay])

  const handleFabSelect = (route: string) => {
    setFabMenuOpen(false)
    navigate(route)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const activePrimaryItem = mainItems.find((item) => item.path && item.path !== '#' && (location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path))))
  const activePrimaryLabel = activePrimaryItem?.label || 'More'

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/20 glass pb-safe lg:hidden">
        <div className="flex h-16 items-center justify-around px-1">
          {mainItems.map((item) => {
            const isActive =
              item.path && item.path !== '#'
                ? location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
                : false

            if (item.isFab) {
              return (
                <div key="fab" className="relative -mt-6">
                  <button
                    onClick={() => setFabMenuOpen((v) => !v)}
                    className="transition-transform focus:outline-none active:scale-95"
                    aria-label="Quick create"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg hover:shadow-xl">
                      <Plus className="h-7 w-7 text-white" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {fabMenuOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setFabMenuOpen(false)}
                          className="fixed inset-0 z-40"
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-16 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
                        >
                          <button
                            onClick={() => {
                              setFabMenuOpen(false)
                              window.dispatchEvent(new CustomEvent('toabh-global-action', { detail: { action: 'open-casting-modal' } }))
                            }}
                            className="glass-dark flex min-w-[190px] items-center gap-2.5 rounded-xl px-4 py-2.5 shadow-xl transition-transform active:scale-[0.97]"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                              <Briefcase className="h-4 w-4 text-amber-400" />
                            </div>
                            <div className="text-left">
                              <span className="block text-sm font-medium text-white">New Casting</span>
                              <span className="block text-[11px] text-white/65">Open a fresh job brief</span>
                            </div>
                          </button>
                          <button
                            onClick={() => handleFabSelect('/tasks?new=true')}
                            className="glass-dark flex min-w-[190px] items-center gap-2.5 rounded-xl px-4 py-2.5 shadow-xl transition-transform active:scale-[0.97]"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                              <CheckSquare className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div className="text-left">
                              <span className="block text-sm font-medium text-white">New Task</span>
                              <span className="block text-[11px] text-white/65">Capture a follow-up fast</span>
                            </div>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )
            }

            return (
              <button
                key={item.path}
                onClick={() => {
                  if (item.path === '#') {
                    setMoreOpen(true)
                  } else {
                    navigate(item.path)
                  }
                }}
                className={cn(
                  'flex h-16 min-w-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors focus:outline-none',
                  isActive ? 'text-amber-600' : 'text-slate-500 active:text-slate-700'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {isActive && item.hint && <span className="text-[8px] leading-none text-amber-500/80">{item.hint}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/20 glass p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden"
            >
              <div className="mb-5 flex justify-center">
                <div className="h-1 w-9 rounded-full bg-slate-200" />
              </div>

              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">More space</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Secondary areas and admin tools</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">You are currently navigating from {activePrimaryLabel}{activePrimaryItem?.path ? ` (${primaryHintMap[activePrimaryItem.path] || 'Primary nav'})` : ''}. Use this sheet for records, reporting, and admin surfaces.</p>
                  </div>
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
                </div>
              </div>

              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">More</h3>
                  <p className="mt-1 text-xs text-slate-500">Use this mobile sheet for secondary workstreams while the bottom bar stays focused on daily actions.</p>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="rounded-full p-2 transition-colors hover:bg-slate-100"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="mb-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-medium leading-5 text-slate-500 shadow-sm">
                  Pick a secondary area below, then return to the main bar for quick navigation between today, jobs, and calendar.
                </div>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Browse</p>
                {visibleMoreItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path)
                        setMoreOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-xl px-4 py-3 transition-colors active:scale-[0.98]',
                        isActive
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <div className="min-w-0 flex-1 text-left">
                        <span className="block font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-slate-400">{item.hint}</span>
                      </div>
                      <ArrowRight className={cn('h-4 w-4', isActive ? 'text-amber-500' : 'text-slate-300')} />
                    </button>
                  )
                })}

                <hr className="my-3 border-slate-200" />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-red-600 transition-colors hover:bg-red-50 active:scale-[0.98]"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
