import { useState, useEffect } from 'react'
import { Loader2, Save, Shield } from 'lucide-react'
import { api } from '@/lib/api'

const PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'jobs', label: 'Jobs / Castings' },
  { key: 'clients', label: 'Clients' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'team', label: 'Team' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'activity', label: 'Activity Log' },
  { key: 'profile', label: 'Profile' },
]

export function PermissionsEditor() {
  const [permissions, setPermissions] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get('/settings/permissions')
      .then((data: any) => setPermissions(data || {}))
      .catch(() => setPermissions({}))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (role: string, page: string) => {
    setPermissions(prev => {
      const rolePerms = { ...(prev[role] || {}) }
      rolePerms[page] = rolePerms[page] ? 0 : 1
      return { ...prev, [role]: rolePerms }
    })
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.put('/settings/permissions', permissions)
      setMessage('Permissions saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-amber-500 animate-spin" /></div>
  }

  const roles = Object.keys(permissions)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">Roles & Permissions</h2>
          <p className="text-sm text-slate-500">Configure page-level access for each role.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {message && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">{message}</div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Permission</th>
              {roles.map(role => (
                <th key={role} className="px-4 py-3 text-center font-semibold text-slate-600 capitalize">
                  <div className="flex items-center justify-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    {role}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PAGES.map((page, i) => (
              <tr key={page.key} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50', 'border-b border-slate-100')}>
                <td className="px-4 py-2.5 font-medium text-slate-700">{page.label}</td>
                {roles.map(role => {
                  const checked = permissions[role]?.[page.key] === 1
                  return (
                    <td key={`${role}-${page.key}`} className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggle(role, page.key)}
                        className={cn(
                          'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all',
                          checked ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                        )}
                      >
                        {checked ? '✓' : '✗'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
