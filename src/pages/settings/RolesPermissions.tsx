import { useState, useEffect, useMemo } from 'react'
import { Loader2, Shield, ShieldCheck, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

interface ErrorWithResponse {
  response?: {
    data?: {
      error?: string
    }
  }
}

const permissions = [
  { id: 'castings_view', name: 'View Castings' },
  { id: 'castings_edit', name: 'Edit Castings' },
  { id: 'castings_delete', name: 'Delete Castings' },
  { id: 'clients_view', name: 'View Clients' },
  { id: 'clients_edit', name: 'Edit Clients' },
  { id: 'team_view', name: 'View Team' },
  { id: 'team_manage', name: 'Manage Team' },
  { id: 'settings_access', name: 'Access Settings' },
  { id: 'reports_view', name: 'View Reports' },
  { id: 'reports_export', name: 'Export Reports' },
]

export function RolesPermissions() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{msg: string; type: 'success'|'error'} | null>(null)
  const [snapshot, setSnapshot] = useState<Role[] | null>(null)

  const fetchRoles = async () => {
    try {
      const data = await api.get('/settings/roles')
      if (Array.isArray(data)) {
        setRoles(data)
      } else if (data && Array.isArray(data.roles)) {
        setRoles(data.roles)
      } else {
        throw new Error('Invalid roles data')
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(t)
  }, [feedback])

  const enabledCount = useMemo(
    () => roles.reduce((count, role) => count + role.permissions.length, 0),
    [roles]
  )

  const togglePermission = (roleId: number, permissionId: string) => {
    setRoles((prev) => prev.map((role) => {
      if (role.id !== roleId) return role
      const hasPermission = role.permissions.includes(permissionId)
      return {
        ...role,
        permissions: hasPermission
          ? role.permissions.filter((p) => p !== permissionId)
          : [...role.permissions, permissionId],
      }
    }))
  }

  const handleSave = async () => {
    setSnapshot([...roles])
    setSaving(true)
    try {
      await api.put('/settings/roles', roles)
      setFeedback({ msg: 'Role permissions saved.', type: 'success' })
    } catch (err: unknown) {
      const error = err as ErrorWithResponse
      if (snapshot) setRoles(snapshot)
      setFeedback({ msg: error?.response?.data?.error || 'Failed to save. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
      setSnapshot(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="mb-2 text-red-500">{error}</p>
        <button onClick={fetchRoles} className="btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roles and permissions</h2>
          <p className="text-sm text-slate-500">Manage access control for your team across castings, clients, reporting, and admin surfaces.</p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-auto">
          {feedback && (
            <span className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium',
              feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}>
              {feedback.msg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Roles</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{roles.length} role{roles.length === 1 ? '' : 's'} loaded</p>
          <p className="mt-1 text-sm text-slate-500">Each column represents one working role inside the operating team.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Permissions granted</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{enabledCount} access grants active</p>
          <p className="mt-1 text-sm text-slate-500">Use this number to catch permission sprawl before it becomes messy.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <Shield className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Access tip</p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">Keep delete and settings access limited to senior operators.</p>
          <p className="mt-1 text-sm text-slate-600">That protects the system while keeping day-to-day execution fast for the wider team.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Permission
                </th>
                {roles.map((role) => (
                  <th key={role.id} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 && (
                <tr>
                  <td colSpan={999} className="py-8 text-center text-gray-400">
                    No roles configured. Default roles will be created on save.
                  </td>
                </tr>
              )}
              {permissions.map((permission, index) => (
                <tr key={permission.id} className={cn('border-b border-slate-50', index % 2 === 1 && 'bg-slate-50/40')}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{permission.name}</td>
                  {roles.map((role) => {
                    const checked = role.permissions.includes(permission.id)
                    return (
                      <td key={role.id} className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePermission(role.id, permission.id)}
                          className={cn(
                            'h-6 w-6 rounded-lg border-2 transition-colors',
                            checked
                              ? 'border-amber-500 bg-amber-500 text-white'
                              : 'border-slate-300 hover:border-slate-400'
                          )}
                        >
                          {checked && (
                            <svg className="h-full w-full" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
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
    </div>
  )
}
