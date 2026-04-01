import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Search, Bell, User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/hooks/useStore'
import { useOverlay } from '@/hooks/useOverlayManager'

const pageTitles: { [key: string]: string } = {
  '/dashboard': 'Dashboard',
  '/castings': 'Castings',
  '/clients': 'Clients',
  '/calendar': 'Calendar',
  '/team': 'Team',
  '/activity': 'Activity Log',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setSearchOpen } = useAppStore()
  const { openOverlay, closeOverlay } = useOverlay()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Register/unregister user menu dropdown with overlay manager
  useEffect(() => {
    if (userMenuOpen) {
      openOverlay('header-user-menu', () => setUserMenuOpen(false))
    } else {
      closeOverlay('header-user-menu')
    }
  }, [userMenuOpen, openOverlay, closeOverlay])

  const pageTitle = pageTitles[location.pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path) && path !== '/dashboard'
    )?.[1] ||
    'Casting Hub'

  const handleLogout = () => {
    sessionStorage.removeItem('admin_verified')
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-100">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left — title only, no hamburger */}
        <h1 className="text-lg font-semibold text-slate-900 pl-0">{pageTitle}</h1>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative group"
          >
            <Search className="w-5 h-5 text-slate-600" />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-50">
              Ctrl+K
            </span>
          </button>

          <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
          </button>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                TB
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 hidden sm:block transition-transform duration-200 ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <>
                  {/* Click-outside backdrop — invisible, sits above page content */}
                  <div
                    onClick={() => setUserMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  {/* Dropdown panel — solid white, full elevation, no transparency */}
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1.5"
                  >
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-slate-100 mb-1">
                      <p className="text-sm font-semibold text-slate-900 leading-tight">Tushar</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">t.tomar2912@gmail.com</p>
                    </div>

                    <button
                      onClick={() => {
                        navigate('/settings')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm font-medium rounded-lg mx-1.5 w-[calc(100%-12px)]"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm font-medium rounded-lg mx-1.5 w-[calc(100%-12px)]"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </button>
                    <div className="my-1.5 mx-3 border-t border-slate-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium rounded-lg mx-1.5 w-[calc(100%-12px)]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
