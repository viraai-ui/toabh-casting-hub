import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Briefcase,
  Plus,
  Calendar,
  MoreHorizontal,
  X,
  Users,
  Activity,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const mainItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
  { icon: Briefcase, label: 'Castings', path: '/castings' },
  { icon: Plus, label: '', path: '/castings/new', isFab: true },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: MoreHorizontal, label: 'More', path: '#' },
]

const moreItems = [
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Activity, label: 'Activity', path: '/activity' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = () => {
    sessionStorage.removeItem('admin_verified')
    navigate('/login')
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass border-t border-white/20 pb-safe">
        <div className="flex items-center justify-around h-16">
          {mainItems.map((item) => {
            const isActive = item.path !== '#' && (
              location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
            )
            
            if (item.isFab) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="relative -mt-6"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow">
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
                  'flex flex-col items-center justify-center w-16 h-16 gap-1 transition-colors',
                  isActive ? 'text-amber-600' : 'text-slate-500'
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
              className="fixed bottom-0 left-0 right-0 z-50 glass rounded-t-3xl border-t border-white/20 p-6 lg:hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Menu</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 transition-colors"
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
                        'w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors',
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
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
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
