import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

const permissions = [
  { id: 'castings_view', name: 'View Jobs' },
  { id: 'castings_edit', name: 'Edit Jobs' },
  { id: 'castings_delete', name: 'Delete Jobs' },
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
      // Handle both {roles: [...]} and [...] formats
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
      setFeedback({ msg: 'Changes saved successfully!', type: 'success' })
    } catch (err: any) {
      if (snapshot) setRoles(snapshot)
      setFeedback({ msg: err?.response?.data?.error || 'Failed to save. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
      setSnapshot(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-red-500 mb-2">{error}</p>
        <button onClick={fetchRoles} className="btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roles & Permissions</h2>
          <p className="text-sm text-slate-500">Manage access control for your team</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {feedback && (
          <span className={`text-sm font-medium ml-3 ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {feedback.msg}
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Permission
                </th>
                {roles.map((role) => (
                  <th key={role.id} className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 && (
                <tr>
                  <td colSpan={999} className="text-center py-8 text-gray-400">
                    No roles configured. Default roles will be created on save.
                  </td>
                </tr>
              )}
              {permissions.map((permission) => (
                <tr key={permission.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">{permission.name}</td>
                  {roles.map((role) => (
                    <td key={role.id} className="px-4 py-3 text-center">
                      <button
                        onClick={() => togglePermission(role.id, permission.id)}
                        className={cn(
                          'w-5 h-5 rounded border-2 transition-colors',
                          role.permissions.includes(permission.id)
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-slate-300 hover:border-slate-400'
                        )}
                      >
                        {role.permissions.includes(permission.id) && (
                          <svg className="w-full h-full text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
