import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Briefcase,
  Plus,
  Users,
  Calendar,
  CheckSquare,
  MoreHorizontal,
  X,
  Activity,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'

// Main bottom nav: Home, Jobs, + (FAB), Clients, More
const mainItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
  { icon: Briefcase, label: 'Jobs', path: '/castings' },
  { icon: Plus, label: '', path: '', isFab: true },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: MoreHorizontal, label: 'More', path: '#' },
]

// More sheet: Calendar, Activity, Reports, Settings
const moreItems = [
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: Activity, label: 'Activity', path: '/activity' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const { openOverlay, closeOverlay } = useOverlay()

  // Register/unregister More sheet with overlay manager
  useEffect(() => {
    if (moreOpen) {
      openOverlay('bottom-nav-more-sheet', () => setMoreOpen(false))
    } else {
      closeOverlay('bottom-nav-more-sheet')
    }
  }, [moreOpen, openOverlay, closeOverlay])

  // Guard against rapid double-taps on the FAB
  const fabNavigating = useRef(false)

  const handleFabClick = () => {
    if (fabNavigating.current) return
    fabNavigating.current = true

    // Open New Casting modal via query param on Castings page
    navigate('/jobs?new=true')

    // Reset guard after navigation settles
    setTimeout(() => {
      fabNavigating.current = false
    }, 600)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_verified')
    navigate('/login')
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass border-t border-white/20 pb-safe">
        <div className="flex items-center justify-around h-16">
          {mainItems.map((item) => {
            const isActive =
              item.path && item.path !== '#'
                ? location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
                : false

            if (item.isFab) {
              return (
                <button
                  key="fab"
                  onClick={handleFabClick}
                  className="relative -mt-6 focus:outline-none active:scale-95 transition-transform"
                  aria-label="Add new casting"
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-shadow',
                      fabNavigating.current
                        ? 'bg-slate-400'
                        : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:shadow-xl'
                    )}
                  >
                    <Plus className="w-7 h-7 text-white" />
                  </div>
                </button>
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
                  'flex flex-col items-center justify-center w-16 h-16 gap-1 transition-colors focus:outline-none',
                  isActive ? 'text-amber-600' : 'text-slate-500 active:text-slate-700'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* More Sheet */}
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
              className="fixed bottom-0 left-0 right-0 z-50 glass rounded-t-3xl border-t border-white/20 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center mb-5">
                <div className="w-9 h-1 bg-slate-200 rounded-full" />
              </div>

              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-slate-900">Menu</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-1">
                {moreItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path)
                        setMoreOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors active:scale-[0.98]',
                        isActive
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  )
                })}

                <hr className="my-3 border-slate-200" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5" />
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
