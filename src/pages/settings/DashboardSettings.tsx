import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const dashboardModules = [
  { id: 'stats', name: 'Stats Overview', description: 'Total castings, active castings, revenue, clients' },
  { id: 'pipeline', name: 'Pipeline Chart', description: 'Bar chart of castings by stage' },
  { id: 'trend', name: 'Trend Chart', description: 'Area chart of monthly casting trends' },
  { id: 'activity', name: 'Activity Feed', description: 'Recent activity stream' },
  { id: 'quick_actions', name: 'Quick Actions', description: 'New casting, search, calendar shortcuts' },
  { id: 'workload', name: 'Team Workload', description: 'Bar chart of team assignments' },
]

const viewModes = [
  { id: 'kanban', name: 'Kanban View', description: 'Drag-and-drop kanban board' },
  { id: 'grid', name: 'Grid View', description: 'Card grid layout' },
  { id: 'list', name: 'List View', description: 'Table view with sorting' },
]

export function DashboardSettings() {
  const [enabledModules, setEnabledModules] = useState<string[]>(
    dashboardModules.map((m) => m.id)
  )
  const [defaultView, setDefaultView] = useState('grid')
  const [saving, setSaving] = useState(false)

  const toggleModule = (id: string) => {
    setEnabledModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/settings/dashboard-modules', {
        enabled_modules: enabledModules,
        default_view: defaultView,
      })
      alert('Dashboard settings saved!')
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
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

      {/* Default View */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-slate-900 mb-4">Default Castings View</h3>
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
                  enabledModules.includes(module.id) ? 'bg-amber-500' : 'bg-slate-200'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    enabledModules.includes(module.id) ? 'left-5' : 'left-0.5'
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
