import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Search, Bell, User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/hooks/useStore'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
    <header className="fixed top-0 left-0 right-0 z-30 h-16 glass border-b border-white/20">
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
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-medium">
                TB
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div
                    onClick={() => setUserMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-48 glass rounded-xl shadow-lg border border-white/20 z-50 py-1"
                  >
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    <hr className="my-1 border-slate-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
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
