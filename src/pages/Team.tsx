import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, Mail, Phone } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { TeamMember, Casting } from '@/types'

export function Team() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [castings, setCastings] = useState<Casting[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)

  const fetchTeam = async () => {
    try {
      const data = await api.get('/team')
      setTeam(data)
    } catch (err) {
      console.error('Failed to fetch team:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCastings = async () => {
    try {
      const data = await api.get('/castings')
      setCastings(data)
    } catch (err) {
      console.error('Failed to fetch castings:', err)
    }
  }

  useEffect(() => {
    fetchTeam()
    fetchCastings()
  }, [])

  const getMemberAssignments = (memberId: number) => {
    return castings.filter((c) => c.assigned_ids?.includes(memberId)).length
  }

  const handleToggleActive = async (member: TeamMember) => {
    try {
      await api.put(`/team/${member.id}`, { ...member, active: !member.active })
      fetchTeam()
    } catch (err) {
      console.error('Failed to toggle:', err)
    }
  }

  const handleDelete = async (member: TeamMember) => {
    const assignments = getMemberAssignments(member.id)
    if (assignments > 0) {
      alert(`Cannot delete ${member.name}. They have ${assignments} active assignments.`)
      return
    }
    if (!confirm(`Delete ${member.name}?`)) return
    try {
      await api.del(`/team/${member.id}`)
      fetchTeam()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingMember(null)
            setModalOpen(true)
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500">No team members yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {team.map((member) => {
            const assignments = getMemberAssignments(member.id)
            const maxAssignments = Math.max(...team.map((m) => getMemberAssignments(m.id)), 1)

            return (
              <motion.div
                key={member.id}
                layout
                className={cn('card p-4', !member.active && 'opacity-60')}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-lg font-semibold">
                    {getInitials(member.name)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingMember(member)
                        setModalOpen(true)
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(member)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 mb-0.5">{member.name}</h3>
                <p className="text-sm text-slate-500 mb-3">{member.role}</p>

                <div className="space-y-2 mb-3">
                  {member.email && (
                    <a
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{member.email}</span>
                    </a>
                  )}
                  {member.phone && (
                    <a
                      href={`tel:${member.phone}`}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {member.phone}
                    </a>
                  )}
                </div>

                {/* Workload */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Workload</span>
                    <span>{assignments} castings</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all"
                      style={{ width: `${(assignments / maxAssignments) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Active</span>
                  <button
                    onClick={() => handleToggleActive(member)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      member.active ? 'bg-amber-500' : 'bg-slate-200'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        member.active ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Team Member Modal */}
      <TeamMemberModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingMember(null)
        }}
        member={editingMember}
        onSave={fetchTeam}
      />
    </div>
  )
}

function TeamMemberModal({
  open,
  onClose,
  member,
  onSave,
}: {
  open: boolean
  onClose: () => void
  member: TeamMember | null
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

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name || '',
        email: member.email || '',
        phone: member.phone || '',
        role: member.role || '',
        avatar_url: member.avatar_url || '',
        active: member.active !== false,
      })
    } else {
      setForm({ name: '', email: '', phone: '', role: '', avatar_url: '', active: true })
    }
  }, [member, open])

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
    <AnimatePresence>
      {open && (
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
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md glass rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
              <h2 className="text-lg font-semibold text-slate-900">
                {member ? 'Edit Member' : 'Add Member'}
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Photographer, Videographer"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Avatar URL</label>
                <input
                  type="url"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Active</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, active: !form.active })}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    form.active ? 'bg-amber-500' : 'bg-slate-200'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      form.active ? 'left-5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
