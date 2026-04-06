import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// Keys match backend dashboard_modules.json
const KNOWN_MODULES = ['kanban', 'calendar', 'activityFeed', 'quickActions', 'charts']
const dashboardModules = [
  { id: 'kanban', name: 'Kanban Board', description: 'Drag-and-drop job pipeline board' },
  { id: 'calendar', name: 'Calendar View', description: 'Shoot date calendar overview' },
  { id: 'activityFeed', name: 'Activity Feed', description: 'Recent activity stream' },
  { id: 'quickActions', name: 'Quick Actions', description: 'New job, search, calendar shortcuts' },
  { id: 'charts', name: 'Charts & Stats', description: 'Analytics charts and summary statistics' },
]

const viewModes = [
  { id: 'kanban', name: 'Kanban View', description: 'Drag-and-drop kanban board' },
  { id: 'grid', name: 'Grid View', description: 'Card grid layout' },
  { id: 'list', name: 'List View', description: 'Table view with sorting' },
]

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
      .then((data: any) => {
        if (!data || typeof data !== 'object') return
        // Backend returns flat key:value like {kanban: true, calendar: true, default_view: 'kanban', ...}
        const saved: Record<string, boolean> = {}
        for (const key of Object.keys(defaultModulesState)) {
          saved[key] = key in data ? Boolean(data[key]) : true
        }
        setModules(saved)
        if (data.default_view) {
          setDefaultView(String(data.default_view))
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

  const toggleModule = (id: string) => {
    if (!KNOWN_MODULES.includes(id)) return
    setModules((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSave = async () => {
    const snapshot = { ...modules }
    setSaving(true)
    try {
      // Only save known module keys to prevent key accumulation
      const filteredModules: Record<string, boolean> = {}
      for (const key of KNOWN_MODULES) {
        filteredModules[key] = modules[key] ?? true
      }
      await api.put('/settings/dashboard-modules', {
        ...filteredModules,
        default_view: defaultView,
      })
      setFeedback({ msg: 'Settings saved!', type: 'success' })
    } catch {
      setModules(snapshot)
      setFeedback({ msg: 'Failed to save settings', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard Settings</h2>
          <p className="text-sm text-slate-500">Customize your dashboard experience</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {feedback && (
        <div className={cn(
          'px-4 py-2 rounded-xl text-sm font-medium',
          feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {feedback.msg}
        </div>
      )}

      {/* Default View */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-slate-900 mb-4">Default Jobs View</h3>
        <div className="grid grid-cols-3 gap-4">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setDefaultView(mode.id)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-colors',
                defaultView === mode.id
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <p className="font-medium text-slate-900">{mode.name}</p>
              <p className="text-xs text-slate-500 mt-1">{mode.description}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Module Visibility */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-slate-900 mb-4">Dashboard Modules</h3>
        <p className="text-sm text-slate-500 mb-4">Choose which modules to show on your dashboard</p>
        <div className="space-y-3">
          {dashboardModules.map((module) => (
            <label
              key={module.id}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
                  modules[module.id] ? 'bg-amber-500' : 'bg-slate-200'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    modules[module.id] ? 'left-5' : 'left-0.5'
                  )}
                />
              </button>
              <div>
                <p className="font-medium text-slate-900">{module.name}</p>
                <p className="text-xs text-slate-500">{module.description}</p>
              </div>
            </label>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
