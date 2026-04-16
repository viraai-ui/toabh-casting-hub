import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, Save, Shield, ShieldCheck, Users } from 'lucide-react'
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

type PermissionsResponse = Record<string, Record<string, number>>

export function PermissionsEditor() {
  const [permissions, setPermissions] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get('/settings/permissions')
      .then((data: unknown) => setPermissions((data as PermissionsResponse) || {}))
      .catch(() => setPermissions({}))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (role: string, page: string) => {
    setPermissions((prev) => {
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

  const roles = Object.keys(permissions)
  const grantedCount = useMemo(
    () => Object.values(permissions).reduce((count, rolePerms) => count + Object.values(rolePerms).filter((value) => value === 1).length, 0),
    [permissions]
  )

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roles and permissions</h2>
          <p className="text-sm text-slate-500">Control which parts of the workspace each role can open and operate.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 self-start">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save access matrix'}
        </button>
      </div>

      {message && (
        <div className={cn(
          'rounded-2xl border px-4 py-3 text-sm font-medium',
          message.includes('Failed')
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        )}>
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Roles</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{roles.length} role{roles.length === 1 ? '' : 's'} configured</p>
          <p className="mt-1 text-sm text-slate-500">Each column maps the access level for one team role.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Granted access</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{grantedCount} permission grants live</p>
          <p className="mt-1 text-sm text-slate-500">Use this to quickly sanity-check overly open access.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <Shield className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Review tip</p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">Keep Settings and Reports tighter than daily execution surfaces.</p>
          <p className="mt-1 text-sm text-slate-600">That usually gives operators speed without exposing admin-only controls.</p>
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <Shield className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-base font-semibold text-slate-900">No roles loaded yet</h3>
          <p className="mt-2 text-sm text-slate-500">Once roles are created, the page-level access matrix will appear here for fast review.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Permission</th>
                {roles.map((role) => (
                  <th key={role} className="px-4 py-3 text-center font-semibold capitalize text-slate-600">
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
                <tr key={page.key} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50', 'border-b border-slate-100 last:border-b-0')}>
                  <td className="px-4 py-3 font-medium text-slate-700">{page.label}</td>
                  {roles.map((role) => {
                    const checked = permissions[role]?.[page.key] === 1
                    return (
                      <td key={`${role}-${page.key}`} className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggle(role, page.key)}
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all',
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
      )}
    </div>
  )
}
