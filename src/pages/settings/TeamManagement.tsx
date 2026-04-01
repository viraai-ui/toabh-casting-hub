import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, Mail } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'
import type { TeamMember } from '@/types'

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

  // Register invite/add member modal with overlay manager
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Team Management</h2>
          <p className="text-sm text-slate-500">Manage your team members</p>
        </div>
        <button
          onClick={() => { setEditingMember(null); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Invite Form */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-slate-400" />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Invite via email..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white/50"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
          >
            <option value="Admin">Admin</option>
            <option value="Booker">Booker</option>
            <option value="Viewer">Viewer</option>
          </select>
          <button onClick={handleInvite} disabled={!inviteEmail.trim()} className="btn-primary">
            Invite
          </button>
        </div>
      </div>

      {/* Team List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {team.map((member) => (
          <motion.div
            key={member.id}
            layout
            className={cn('card p-4', !member.is_active && 'opacity-60')}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold">
                {getInitials(member.name)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{member.name}</h3>
                <p className="text-sm text-slate-500">{member.role}</p>
                {member.email && (
                  <p className="text-xs text-slate-400 mt-1">{member.email}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingMember(member); setModalOpen(true) }}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(member)}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Member Modal */}
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
      .then((data: any) => {
        const names = data?.roles?.map((r: any) => r.name) || ['Admin', 'Booker', 'Viewer']
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md glass rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {member ? 'Edit Member' : 'Add Member'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            >
              <option value="">Select role</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
