import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Bell, User, Settings, LogOut, ChevronDown, CheckCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/hooks/useStore'
import { useOverlay } from '@/hooks/useOverlayManager'
import { api, toApiUrl } from '@/lib/api'
import { getInitials } from '@/lib/utils'
import type { Activity } from '@/types'
import { logout } from '@/lib/api'
import { useDataRefresh } from '@/hooks/useDataRefresh'

const pageTitles: { [key: string]: string } = {
  '/dashboard': 'Today',
  '/castings': 'Jobs',
  '/clients': 'Clients',
  '/calendar': 'Calendar',
  '/team': 'Team',
  '/activity': 'Inbox',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/tasks': 'Tasks',
  '/talents': 'Talents',
}

const pageSubtitles: { [key: string]: string } = {
  '/dashboard': 'Urgency, movement, and next actions',
  '/castings': 'Live work queue and job movement',
  '/clients': 'Relationship and contact layer',
  '/calendar': 'Agenda first, planning when needed',
  '/team': 'Ownership, handoffs, and workload',
  '/activity': 'Recent movement across the workspace',
  '/reports': 'Performance and business visibility',
  '/settings': 'Admin controls and configuration',
  '/profile': 'Your profile and account settings',
  '/tasks': 'Follow-ups, reminders, and action items',
  '/talents': 'Visual roster and talent operations',
}

const NOTIFICATION_STORAGE_KEY = 'toabh_notification_reads'

const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

const formatRelativeTime = (value?: string) => {
  if (!value) return 'Just now'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const getNotificationTitle = (activity: Activity) => {
  const description = safeText(activity.description)
  if (description) return description

  const action = safeText(activity.action).replaceAll('_', ' ').toLowerCase()
  return action ? action.charAt(0).toUpperCase() + action.slice(1) : 'New activity'
}

const getNotificationMeta = (activity: Activity) => {
  const parts = [safeText(activity.user_name), activity.casting_id ? `Casting #${activity.casting_id}` : '']
    .filter(Boolean)
  return parts.join(' • ') || 'Casting Hub'
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setSearchOpen, currentUser } = useAppStore()
  const { openOverlay, closeOverlay } = useOverlay()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Activity[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [readIds, setReadIds] = useState<number[]>([])
  const notificationTriggerRef = useRef<HTMLButtonElement | null>(null)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATION_STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved)
      setReadIds(Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [])
    } catch {
      setReadIds([])
    }
  }, [])

  const persistReadIds = (ids: number[]) => {
    setReadIds(ids)
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(ids.slice(0, 100)))
  }

  useEffect(() => {
    if (userMenuOpen) {
      openOverlay('header-user-menu', () => setUserMenuOpen(false))
    } else {
      closeOverlay('header-user-menu')
    }
  }, [userMenuOpen, openOverlay, closeOverlay])

  useEffect(() => {
    if (notificationsOpen) {
      openOverlay('header-notifications', () => setNotificationsOpen(false))
    } else {
      closeOverlay('header-notifications')
    }
  }, [notificationsOpen, openOverlay, closeOverlay])

  useEffect(() => {
    if (!notificationsOpen) return

    const handleOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (notificationTriggerRef.current?.contains(target)) return
      if (notificationPanelRef.current?.contains(target)) return

      setNotificationsOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideInteraction)
    document.addEventListener('touchstart', handleOutsideInteraction)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction)
      document.removeEventListener('touchstart', handleOutsideInteraction)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [notificationsOpen])

  const fetchNotifications = async (showLoader = false) => {
    if (showLoader) setLoadingNotifications(true)

    try {
      const data = await api.get('/activities')
      const items = Array.isArray((data as { activities?: Activity[] })?.activities)
        ? (data as { activities: Activity[] }).activities
        : []
      setNotifications(items.slice(0, 8))
    } catch (err) {
      console.error('Notifications error:', err)
      setNotifications([])
    } finally {
      if (showLoader) setLoadingNotifications(false)
    }
  }

  useEffect(() => {
    void fetchNotifications(true)
    const interval = window.setInterval(() => void fetchNotifications(false), 45000)
    return () => window.clearInterval(interval)
  }, [])

  useDataRefresh(() => {
    void fetchNotifications(false)
  })

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.includes(item.id)).length,
    [notifications, readIds]
  )

  const matchedTitleEntry = Object.entries(pageTitles).find(([path]) =>
    location.pathname === path || (location.pathname.startsWith(path) && path !== '/dashboard')
  )

  const pageTitle = matchedTitleEntry?.[1] || 'Casting Hub'
  const pageSubtitle = (matchedTitleEntry && pageSubtitles[matchedTitleEntry[0]]) || 'Premium agency operating workspace'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const markAllRead = () => {
    persistReadIds(Array.from(new Set([...readIds, ...notifications.map((item) => item.id)])))
  }

  const openNotification = (activity: Activity) => {
    persistReadIds(Array.from(new Set([...readIds, activity.id])))
    setNotificationsOpen(false)

    if (activity.casting_id) {
      navigate(`/castings?id=${activity.casting_id}`)
      return
    }

    navigate('/activity')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-100">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">{pageTitle}</h1>
          <p className="hidden truncate text-xs text-slate-500 sm:block">{pageSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 pl-3">
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative group"
          >
            <Search className="w-5 h-5 text-slate-600" />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-50">
              Ctrl+K
            </span>
          </button>

          <div className="hidden xl:flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm">
            Search with Ctrl+K, review alerts here, then jump straight into the next action.
          </div>

          <div className="relative">
            <button
              ref={notificationTriggerRef}
              onClick={() => setNotificationsOpen((open) => !open)}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                  <motion.div
                    ref={notificationPanelRef}
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Notifications</p>
                        <p className="text-xs text-slate-500">Recent activity from your agency workspace</p>
                      </div>
                      <button
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        disabled={notifications.length === 0 || unreadCount === 0}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    </div>

                    <div className="max-h-[24rem] overflow-y-auto p-2">
                      {loadingNotifications ? (
                        <div className="flex items-center justify-center py-10 text-slate-400">
                          <Bell className="h-5 w-5 animate-pulse" />
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 px-6 py-10 text-center">
                          <Bell className="h-5 w-5 text-slate-300" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">No notifications yet</p>
                            <p className="mt-1 text-xs text-slate-500">New activity will show up here automatically. Keep this panel for quick triage without opening the full inbox.</p>
                          </div>
                        </div>
                      ) : (
                        notifications.map((activity) => {
                          const unread = !readIds.includes(activity.id)
                          return (
                            <button
                              key={activity.id}
                              onClick={() => openNotification(activity)}
                              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
                            >
                              <div className="flex pt-1">
                                <span className={`h-2.5 w-2.5 rounded-full ${unread ? 'bg-amber-500' : 'bg-slate-200'}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-medium text-slate-900">{getNotificationTitle(activity)}</p>
                                  <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(activity.created_at)}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{getNotificationMeta(activity)}</p>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              {currentUser?.avatar ? (
                <img
                  src={toApiUrl(currentUser.avatar)}
                  alt={currentUser.name}
                  className="h-8 w-8 rounded-full object-cover bg-slate-100 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                  {currentUser ? getInitials(currentUser.name) : 'TB'}
                </div>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 hidden sm:block transition-transform duration-200 ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div onClick={() => setUserMenuOpen(false)} className="fixed inset-0 z-40" />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1.5"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 mb-1">
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{currentUser?.name || 'Team Member'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{currentUser?.email || 'admin@toabh.com'}</p>
                    </div>

                    <button
                      onClick={() => {
                        navigate('/profile')
                        setUserMenuOpen(false)
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm font-medium rounded-lg mx-1.5 w-[calc(100%-12px)]"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setUserMenuOpen(false)
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm font-medium rounded-lg mx-1.5 w-[calc(100%-12px)]"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </button>
                    <div className="my-1.5 mx-3 border-t border-slate-100" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium rounded-lg mx-1.5 w-[calc(100%-12px)]"
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
