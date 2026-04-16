import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Grid3X3, LayoutPanelTop, Loader2, Rows3 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const KNOWN_MODULES = ['kanban', 'calendar', 'activityFeed', 'quickActions', 'charts']
const dashboardModules = [
  { id: 'kanban', name: 'Kanban Board', description: 'Drag-and-drop casting pipeline board' },
  { id: 'calendar', name: 'Calendar View', description: 'Shoot date calendar overview' },
  { id: 'activityFeed', name: 'Activity Feed', description: 'Recent activity stream' },
  { id: 'quickActions', name: 'Quick Actions', description: 'New casting, search, calendar shortcuts' },
  { id: 'charts', name: 'Charts & Stats', description: 'Analytics charts and summary statistics' },
]

const viewModes = [
  { id: 'kanban', name: 'Kanban View', description: 'Drag-and-drop kanban board', icon: LayoutPanelTop },
  { id: 'grid', name: 'Grid View', description: 'Card grid layout', icon: Grid3X3 },
  { id: 'list', name: 'List View', description: 'Table view with sorting', icon: Rows3 },
]

interface DashboardModulesResponse extends Record<string, unknown> {
  default_view?: string
}

const defaultModulesState: Record<string, boolean> = {
  kanban: true,
  calendar: true,
  activityFeed: true,
  quickActions: true,
  charts: true,
}

export function DashboardSettings() {
  const [modules, setModules] = useState<Record<string, boolean>>(defaultModulesState)
  const [defaultView, setDefaultView] = useState('kanban')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{msg: string; type: 'success'|'error'} | null>(null)

  useEffect(() => {
    api.get('/settings/dashboard-modules')
      .then((data: unknown) => {
        if (!data || typeof data !== 'object') return
        const payload = data as DashboardModulesResponse
        const saved: Record<string, boolean> = {}
        for (const key of Object.keys(defaultModulesState)) {
          saved[key] = key in payload ? Boolean(payload[key]) : true
        }
        setModules(saved)
        if (payload.default_view) {
          setDefaultView(String(payload.default_view))
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(t)
  }, [feedback])

  const enabledModulesCount = useMemo(() => Object.values(modules).filter(Boolean).length, [modules])

  const toggleModule = (id: string) => {
    if (!KNOWN_MODULES.includes(id)) return
    setModules((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSave = async () => {
    const snapshot = { ...modules }
    setSaving(true)
    try {
      const filteredModules: Record<string, boolean> = {}
      for (const key of KNOWN_MODULES) {
        filteredModules[key] = modules[key] ?? true
      }
      await api.put('/settings/dashboard-modules', {
        ...filteredModules,
        default_view: defaultView,
      })
      setFeedback({ msg: 'Dashboard settings saved.', type: 'success' })
    } catch {
      setModules(snapshot)
      setFeedback({ msg: 'Failed to save dashboard settings.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard settings</h2>
          <p className="text-sm text-slate-500">Tune the default operating view and keep only the modules your team actually uses.</p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-auto">
          {feedback && (
            <div className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium',
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            )}>
              {feedback.msg}
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Default view</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{viewModes.find((mode) => mode.id === defaultView)?.name ?? 'Kanban View'}</p>
          <p className="mt-1 text-sm text-slate-500">This is where operators land first.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Visible modules</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{enabledModulesCount} of {dashboardModules.length} enabled</p>
          <p className="mt-1 text-sm text-slate-500">Hide low-value blocks to reduce dashboard noise.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <BarChart3 className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Operating guidance</p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">Keep the default view simple on mobile, richer on desktop.</p>
          <p className="mt-1 text-sm text-slate-600">A tighter first screen makes Phase 4 feel more deliberate.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">Default castings view</h3>
          <p className="mt-1 text-sm text-slate-500">Choose the layout that best matches how your operators scan live work.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {viewModes.map((mode) => {
            const Icon = mode.icon
            return (
              <button
                key={mode.id}
                onClick={() => setDefaultView(mode.id)}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  defaultView === mode.id
                    ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{mode.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{mode.description}</p>
                  </div>
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl',
                    defaultView === mode.id ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6"
      >
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Dashboard modules</h3>
            <p className="mt-1 text-sm text-slate-500">Choose which modules should appear on the dashboard canvas.</p>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{enabledModulesCount} enabled</p>
        </div>
        <div className="space-y-3">
          {dashboardModules.map((module) => (
            <div
              key={module.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{module.name}</p>
                <p className="mt-1 text-sm text-slate-500">{module.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={modules[module.id]}
                aria-label={`${module.name} visibility`}
                onClick={() => toggleModule(module.id)}
                className={cn(
                  'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors',
                  modules[module.id] ? 'bg-amber-500' : 'bg-slate-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform',
                    modules[module.id] ? 'translate-x-7' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
