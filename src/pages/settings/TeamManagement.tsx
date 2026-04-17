import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'
import type { TeamMember } from '@/types'

interface RolesResponse {
  roles?: Array<{ name: string }>
}

export function TeamManagement() {
  const { openOverlay, closeOverlay } = useOverlay()
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Booker')

  const fetchTeam = async () => {
    try {
      const data = await api.get('/team')
      setTeam(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch:', err)
      setTeam([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeam()
  }, [])

  useEffect(() => {
    if (modalOpen) {
      openOverlay('team-management-modal', () => setModalOpen(false))
    } else {
      closeOverlay('team-management-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

  const handleDelete = async (member: TeamMember) => {
    if (!confirm(`Delete ${member.name}?`)) return
    try {
      await api.del(`/team/${member.id}`)
      fetchTeam()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    try {
      await api.post('/team', {
        name: inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole,
        phone: '',
        active: true,
      })
      setInviteEmail('')
      fetchTeam()
    } catch (err) {
      console.error('Failed to invite:', err)
    }
  }

  const activeCount = useMemo(() => team.filter((member) => member.is_active !== false).length, [team])
  const inactiveCount = team.length - activeCount

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Team management</h2>
          <p className="text-sm text-slate-500">Manage the operating roster, invite new teammates, and keep ownership structure clear.</p>
        </div>
        <button
          onClick={() => { setEditingMember(null); setModalOpen(true) }}
          className="btn-primary flex shrink-0 items-center gap-1.5 text-xs sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add member</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Roster</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{team.length} members</p>
          <p className="mt-1 text-sm text-slate-500">Treat this as the live ownership map for TOABH operations.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Status mix</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{activeCount} active, {inactiveCount} inactive</p>
          <p className="mt-1 text-sm text-slate-500">Keeping inactive members visible helps preserve historical ownership context.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Management tip</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Invite by role first, then refine permissions only where needed.</p>
          <p className="mt-1 text-sm text-slate-600">That keeps onboarding faster and avoids overcomplicating team setup too early.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm font-medium text-slate-600">Quick invite</span>
          </div>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Invite via email..."
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:min-w-[140px]"
          >
            <option value="Admin">Admin</option>
            <option value="Booker">Booker</option>
            <option value="Viewer">Viewer</option>
          </select>
          <button onClick={handleInvite} disabled={!inviteEmail.trim()} className="btn-primary self-start sm:self-auto">
            Invite
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {team.length === 0 ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Team setup</p>
            <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">No team members added yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Invite your core casting team so permissions, ownership, and communication stay clear from day one.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">This becomes the operating roster for assignment clarity, approvals, and role-based access as the workspace scales.</p>
          </div>
        ) : team.map((member) => (
          <motion.div
            key={member.id}
            layout
            className={cn(
              'flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm transition-all hover:shadow-md sm:px-4',
              member.is_active === false && 'opacity-60'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-semibold text-white sm:h-11 sm:w-11">
              {getInitials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900 sm:text-[15px]">{member.name}</p>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  member.is_active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {member.is_active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">{member.email || member.role}</p>
              {member.role && <p className="mt-1 text-xs text-slate-500">Role: {member.role}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => { setEditingMember(member); setModalOpen(true) }}
                title="Edit"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600 sm:h-11 sm:w-11"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(member)}
                title="Delete"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 sm:h-11 sm:w-11"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {modalOpen && (
        <TeamMemberModal
          member={editingMember}
          onClose={() => { setModalOpen(false); setEditingMember(null) }}
          onSave={fetchTeam}
        />
      )}
    </div>
  )
}

function TeamMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember | null
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    avatar_url: '',
    active: true,
  })
  const [saving, setSaving] = useState(false)
  const [roleOptions, setRoleOptions] = useState<string[]>(['Admin', 'Booker', 'Viewer'])

  useEffect(() => {
    api.get('/settings/roles')
      .then((data: unknown) => {
        const payload = data as RolesResponse
        const names = payload?.roles?.map((r) => r.name) || ['Admin', 'Booker', 'Viewer']
        setRoleOptions(names)
      })
      .catch(() => setRoleOptions(['Admin', 'Booker', 'Viewer']))
  }, [])

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name || '',
        email: member.email || '',
        phone: member.phone || '',
        role: member.role || '',
        avatar_url: member.avatar_url || '',
        active: member.is_active !== false,
      })
    } else {
      setForm({ name: '', email: '', phone: '', role: '', avatar_url: '', active: true })
    }
  }, [member])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (member) {
        await api.put(`/team/${member.id}`, form)
      } else {
        await api.post('/team', form)
      }
      onSave()
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleModalClose = () => {
    if (saving) return
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={handleModalClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass relative w-full max-w-md rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{member ? 'Edit member' : 'Add member'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Name *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2">
              <option value="">Select role</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={handleModalClose} disabled={saving} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
