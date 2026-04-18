import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, Mail, Phone, Search, X, Camera, User, MailQuestion, Shield, ShieldCheck, ShieldAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { TeamMember, Casting } from '@/types'

interface TeamMemberWithInviteStatus extends TeamMember {
  invite_status?: string
}

interface RolesResponse {
  roles?: Array<{ name: string }>
}

interface ErrorWithMessage {
  message?: string
}
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'

export function Team() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const teamWithInvite = team as TeamMemberWithInviteStatus[]
  const { openOverlay, closeOverlay } = useOverlay()
  const [team, setTeam] = useState<TeamMember[]>([])
  const [castings, setCastings] = useState<Casting[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [viewMember, setViewMember] = useState<TeamMember | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusFilter, setFocusFilter] = useState<'all' | 'active' | 'pending' | 'unassigned'>('all')

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.get('/team')
      setTeam(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch team:', err)
      setTeam([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCastings = useCallback(async () => {
    try {
      const data = await api.get('/castings')
      setCastings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch castings:', err)
      setCastings([])
    }
  }, [])

  useEffect(() => {
    void fetchTeam()
    void fetchCastings()
  }, [fetchTeam, fetchCastings])

  useDataRefresh(() => {
    void fetchTeam()
    void fetchCastings()
  })

  // Register Add/Edit Team Member modal with overlay manager
  useEffect(() => {
    if (modalOpen) {
      openOverlay('team-member-modal', () => setModalOpen(false))
    } else {
      closeOverlay('team-member-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

  // Register View Member dialog with overlay manager
  useEffect(() => {
    if (viewMember) {
      openOverlay('team-member-view', () => setViewMember(null))
    } else {
      closeOverlay('team-member-view')
    }
  }, [viewMember, openOverlay, closeOverlay])

  useEffect(() => {
    const targetId = Number(searchParams.get('id'))
    if (!targetId || !team.length) return

    const match = team.find((member) => member.id === targetId)
    if (!match) return

    setViewMember(match)
    navigate('/team', { replace: true })
  }, [navigate, searchParams, team])

  const getMemberAssignments = (memberId: string | number) => {
    return castings.filter((c) => {
      if (!c.assigned_ids) return false
      const ids = (c.assigned_ids || '').toString().split(',').map((s) => s.trim())
      return ids.includes(String(memberId))
    }).length
  }

  const handleToggleActive = async (member: TeamMember) => {
    try {
      await api.put(`/team/${member.id}`, { ...member, is_active: !member.is_active })
      fetchTeam()
    } catch (err) {
      console.error('Failed to toggle:', err)
    }
  }

  const handleResendInvite = async (memberId: number, memberName: string) => {
    if (!confirm(`Resend invite email to ${memberName}?`)) return
    try {
      const result = await fetch(`/api/team/${memberId}/resend-invite`, {
        method: 'POST',
      }).then(r => r.json())
      if (result?.sent) {
        alert(`Invite resent to ${memberName}`)
        fetchTeam()
      } else {
        alert(result?.message || 'Failed to resend invite. Is SMTP configured?')
      }
    } catch (err: unknown) {
      const error = err as ErrorWithMessage
      alert('Failed to resend invite: ' + (error?.message || 'Unknown error'))
    }
  }

  const statusBadge = (member: TeamMember) => {
    const inviteStatus = (member as TeamMemberWithInviteStatus).invite_status
    const isActive = member.is_active !== false
    if (!isActive) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"><X className="h-2.5 w-2.5" />Disabled</span>
    }
    if (inviteStatus === 'pending' || !inviteStatus) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
          <MailQuestion className="h-2.5 w-2.5" />Invite Pending
        </span>
      )
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"><ShieldCheck className="h-2.5 w-2.5" />Active</span>
  }

  const roleBadge = (role?: string) => {
    const r = (role || '').toLowerCase()
    const icon = r.includes('admin') ? <ShieldAlert className="h-3 w-3" /> : r.includes('lead') || r.includes('manage') ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />
    const cls = r.includes('admin') ? 'bg-red-50 text-red-600' : r.includes('lead') || r.includes('manage') ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", cls)}>
        {icon}
        {(role || 'Member').toUpperCase()}
      </span>
    )
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

  const teamStats = useMemo(() => {
    const activeCount = teamWithInvite.filter((member) => member.is_active !== false && member.is_active !== 0).length
    const pendingInvites = teamWithInvite.filter((member) => member.is_active !== false && member.is_active !== 0 && (((member as TeamMemberWithInviteStatus).invite_status || 'pending') === 'pending')).length
    const assignedCount = teamWithInvite.filter((member) => getMemberAssignments(member.id) > 0).length
    const unassignedCount = Math.max(teamWithInvite.length - assignedCount, 0)
    return { activeCount, pendingInvites, assignedCount, unassignedCount }
  }, [teamWithInvite, castings])

  const filteredTeam = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return teamWithInvite.filter((member) => {
      const assignments = getMemberAssignments(member.id)
      const inviteStatus = (member as TeamMemberWithInviteStatus).invite_status || 'pending'
      const matchesQuery =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.role?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query)

      const matchesFocus =
        focusFilter === 'all' ||
        (focusFilter === 'active' && assignments > 0) ||
        (focusFilter === 'pending' && inviteStatus === 'pending') ||
        (focusFilter === 'unassigned' && assignments === 0)

      return matchesQuery && matchesFocus
    })
  }, [teamWithInvite, searchQuery, focusFilter, castings])

  const teamPriority = useMemo(() => {
    if (teamWithInvite.length === 0) {
      return {
        label: 'Build the team board first',
        note: 'Adding the first operator unlocks ownership, invite tracking, and workload balancing across the platform.',
        tone: 'border-slate-200 bg-slate-50 text-slate-700',
      }
    }

    if (teamStats.pendingInvites > 0) {
      return {
        label: 'Pending invites are the biggest team gap',
        note: `${teamStats.pendingInvites} teammate${teamStats.pendingInvites === 1 ? '' : 's'} still need to complete access setup before they can carry work safely.`,
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    }

    if (teamStats.unassignedCount > 0) {
      return {
        label: 'You have free capacity to deploy',
        note: `${teamStats.unassignedCount} teammate${teamStats.unassignedCount === 1 ? '' : 's'} currently have no casting ownership, so workload can be redistributed.`,
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
      }
    }

    return {
      label: 'Team coverage looks healthy',
      note: 'Invites and ownership are aligned well enough for this page to act like a live staffing board.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }, [teamStats.pendingInvites, teamStats.unassignedCount, teamWithInvite.length])

  const teamSignals = useMemo(() => ([
    {
      label: 'Focus view',
      value: focusFilter === 'all' ? 'Full team board' : focusFilter === 'active' ? 'Active owners' : focusFilter === 'pending' ? 'Pending invites' : 'Free capacity',
      note: focusFilter === 'all' ? 'You are looking at the broadest staffing picture.' : 'This board is narrowed to a specific staffing slice right now.',
    },
    {
      label: 'Search state',
      value: searchQuery.trim() ? 'Search active' : 'No search applied',
      note: searchQuery.trim() ? 'The roster is narrowed before you assess ownership and invite health.' : 'No search filter is trimming the current team view.',
    },
    {
      label: 'Visible roster',
      value: `${filteredTeam.length}/${teamWithInvite.length} visible`,
      note: teamWithInvite.length === 0 ? 'The team roster has not been created yet.' : 'This shows how much of the roster is visible inside the current focus view.',
    },
  ]), [filteredTeam.length, focusFilter, searchQuery, teamWithInvite.length])

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Team
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              Team ownership, invite health, and workload in one view.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 1 reframes this into an operating surface so you can spot active owners, pending invites, and unused capacity faster.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingMember(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]"
          >
            <Plus className="w-4 h-4" />
            Add member
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TeamStatCard label="Team size" value={teamWithInvite.length} note="Everyone currently loaded into the workspace." tone="border-slate-200/70 bg-slate-50 text-slate-600" />
        <TeamStatCard label="Active owners" value={teamStats.assignedCount} note="Members currently carrying at least one casting." tone="border-amber-200/70 bg-amber-50 text-amber-700" />
        <TeamStatCard label="Pending invites" value={teamStats.pendingInvites} note="People who still need to complete access setup." tone="border-blue-200/70 bg-blue-50 text-blue-700" />
        <TeamStatCard label="Free capacity" value={teamStats.unassignedCount} note="Members with zero casting assignments right now." tone="border-emerald-200/70 bg-emerald-50 text-emerald-700" />
      </section>

      <section className={cn('rounded-3xl border px-5 py-4 shadow-sm', teamPriority.tone)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">Team priority</p>
            <p className="mt-1 text-base font-semibold text-slate-950">{teamPriority.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{teamPriority.note}</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Staffing snapshot</p>
            <p className="mt-1 font-semibold text-slate-900">{teamStats.assignedCount} active owner{teamStats.assignedCount === 1 ? '' : 's'}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Track invite completion, free capacity, and live ownership from the same surface.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {teamSignals.map((signal) => (
          <div key={signal.label} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{signal.label}</p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{signal.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{signal.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search team members, role, email, or phone..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: `All (${teamWithInvite.length})` },
              { key: 'active', label: `Active owners (${teamStats.assignedCount})` },
              { key: 'pending', label: `Pending invites (${teamStats.pendingInvites})` },
              { key: 'unassigned', label: `Free capacity (${teamStats.unassignedCount})` },
            ].map((option) => {
              const active = focusFilter === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFocusFilter(option.key as 'all' | 'active' | 'pending' | 'unassigned')}
                  className={cn(
                    'rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Team Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Team board</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">No operators added yet</p>
          <p className="mt-2 text-sm text-slate-500">Bring in your first team member to unlock ownership, handoffs, and cleaner follow-through across every casting.</p>
          <p className="mt-2 text-xs text-slate-400">This becomes the live ownership board once operators, roles, and active jobs start lining up.</p>
        </div>
      ) : filteredTeam.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Team board</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">Nothing matches this view</p>
          <p className="mt-2 text-sm text-slate-500">Adjust the search or switch filters to bring the right owners back into focus.</p>
          <p className="mt-2 text-xs text-slate-400">Use this view to isolate exactly who is active, overloaded, or currently off the board.</p>
          <p className="mt-2 text-xs text-slate-400">If the full roster should be visible here, clear search first, then reset the focus chips.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {filteredTeam.map((member) => {
            const assignments = getMemberAssignments(member.id)
            const maxAssignments = Math.max(...team.map((m) => getMemberAssignments(m.id)), 1)

            return (
              <motion.div
                key={member.id}
                layout
                onClick={() => setViewMember(member)}
                className={cn(
                  'card p-4 cursor-pointer transition-all hover:border-amber-300 hover:shadow-md',
                  !member.is_active && 'opacity-60'
                )}
              >
                {/* Top row: avatar + action buttons */}
                <div className="flex items-start justify-between mb-3">
                  <MemberAvatar member={member} size={56} />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingMember(member)
                        setModalOpen(true)
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {/* Resend invite for pending members */}
                    {member.invite_status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResendInvite(member.id, member.name)
                        }}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600"
                        title="Resend invite"
                      >
                        <MailQuestion className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleActive(member)
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      title={member.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <User className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(member)
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-slate-900">{member.name}</h3>
                  <div className="flex gap-1 shrink-0 ml-2 flex-wrap justify-end">
                    {roleBadge(member.role)}
                    {statusBadge(member)}
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-3">{member.role || 'Team Member'}</p>

                <div className="space-y-2 mb-3">
                  {member.email && (
                    <a
                      href={`mailto:${member.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </a>
                  )}
                  {member.phone && (
                    <a
                      href={`tel:${member.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{member.phone}</span>
                    </a>
                  )}
                </div>

                {/* Workload */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Workload</span>
                    <span>{assignments} casting{assignments !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all"
                      style={{ width: `${Math.min((assignments / maxAssignments) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleActive(member)
                    }}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      member.is_active ? 'bg-amber-500' : 'bg-slate-200'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        member.is_active ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Team Member Modal (Create/Edit) */}
      <TeamMemberModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingMember(null)
        }}
        member={editingMember}
        onSave={fetchTeam}
      />

      {/* View Member Modal (Read-only) */}
      <MemberViewModal
        member={viewMember}
        onClose={() => setViewMember(null)}
        onEdit={() => {
          if (!viewMember) return
          setViewMember(null)
          setEditingMember(viewMember)
          setModalOpen(true)
        }}
        castings={castings}
      />
    </div>
  )
}

function TeamStatCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  return (
    <div className={cn('rounded-3xl border p-5 shadow-sm', tone)}>
      <p className="text-sm font-medium text-current/80">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  )
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function MemberAvatar({
  member,
  size = 56,
  showFallback = true,
}: {
  member: TeamMember
  size?: number
  showFallback?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(member.name)

  const avatarSrc = member.avatar_url
    ? (member.avatar_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${member.avatar_url}` : member.avatar_url)
    : null

  if (avatarSrc && !imgError) {
    return (
      <img
        src={avatarSrc}
        alt={member.name}
        onError={() => setImgError(true)}
        className="rounded-2xl object-cover bg-slate-100"
        style={{ width: size, height: size }}
      />
    )
  }

  if (showFallback) {
    return (
      <div
        className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    )
  }

  return null
}

// ─── View Modal ────────────────────────────────────────────────────────────────

function MemberViewModal({
  member,
  onClose,
  onEdit,
  castings,
}: {
  member: TeamMember | null
  onClose: () => void
  onEdit: () => void
  castings: Casting[]
}) {
  if (!member) return null

  const assignedCastings = castings.filter((c) => {
    if (!c.assigned_ids) return false
    const ids = (c.assigned_ids || '').toString().split(',').map((s) => s.trim())
    return ids.includes(String(member.id))
  })

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header with avatar + name */}
      <div className="relative bg-gradient-to-br from-amber-500 to-amber-700 px-6 pt-6 pb-16">
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute', right: 8, top: 8,
            color: 'white', bgcolor: 'rgba(255,255,255,0.2)',
          }}
        >
          <X className="w-5 h-5" />
        </IconButton>

        {/* Large avatar centered */}
        <div className="flex flex-col items-center">
          <div
            className="rounded-full bg-white/20 backdrop-blur-sm p-1"
          >
            {member.avatar_url ? (
              <img
                src={`${import.meta.env.VITE_API_URL || ''}${member.avatar_url}`}
                alt={member.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-2xl">
                {getInitials(member.name)}
              </div>
            )}
          </div>
          <h2 className="mt-3 text-xl font-bold text-white">{member.name}</h2>
          <p className="text-amber-100 text-sm">{member.role || 'Team Member'}</p>
          <span
            className={cn(
              'mt-2 inline-block px-3 py-0.5 rounded-full text-xs font-medium',
              member.is_active
                ? 'bg-green-500/30 text-green-100'
                : 'bg-slate-500/30 text-slate-200'
            )}
          >
            {member.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <DialogContent sx={{ px: 3, pb: 3, pt: 5 }}>
        {/* Contact info */}
        <div className="space-y-3 mb-5">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-amber-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Mail className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-900">{member.email}</p>
              </div>
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-amber-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Phone className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-sm font-medium text-slate-900">{member.phone}</p>
              </div>
            </a>
          )}
          {!member.email && !member.phone && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <User className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400 italic">Contact details have not been added yet</p>
            </div>
          )}
        </div>

        {/* Assigned castings */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">
            Assigned Castings ({assignedCastings.length})
          </p>
          {assignedCastings.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No live castings are assigned right now. This operator is fully open for the next brief and can absorb fresh ownership immediately.</p>
          ) : (
            <div className="space-y-2">
              {assignedCastings.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-sm font-medium text-slate-700 truncate">{c.project_name || c.client_name}</span>
                  <span className="text-xs text-slate-400 ml-2 shrink-0">{c.status}</span>
                </div>
              ))}
              {assignedCastings.length > 5 && (
                <p className="text-xs text-slate-400 text-center">
                  +{assignedCastings.length - 5} more assignments in motion
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5">
          <Button variant="outlined" fullWidth onClick={onClose} sx={{ borderRadius: '12px' }}>
            Close
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={onEdit}
            startIcon={<Pencil className="w-4 h-4" />}
            sx={{ borderRadius: '12px', bgcolor: 'amber.500', '&:hover': { bgcolor: 'amber.600' } }}
          >
            Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create/Edit Modal ─────────────────────────────────────────────────────────

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
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [roles, setRoles] = useState<string[]>(['Admin', 'Booker', 'Viewer'])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/settings/roles')
      .then((data: unknown) => {
        const payload = data as RolesResponse
        const roleNames = payload.roles?.map((r) => r.name) || ['Admin', 'Booker', 'Viewer']
        setRoles(roleNames)
      })
      .catch(() => setRoles(['Admin', 'Booker', 'Viewer']))
  }, [])

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name || '',
        email: member.email || '',
        phone: member.phone || '',
        role: member.role || '',
        avatar_url: member.avatar_url || '',
        is_active: member.is_active !== false,
      })
    } else {
      setForm({ name: '', email: '', phone: '', role: '', avatar_url: '', is_active: true })
    }
  }, [member, open])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !member?.id) return

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      alert('Please select a PNG, JPG, GIF, or WebP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB.')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/team/${member.id}/avatar`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setForm((prev) => ({ ...prev, avatar_url: data.avatar_url }))
    } catch {
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

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

  const previewSrc = form.avatar_url
    ? (form.avatar_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${form.avatar_url}` : form.avatar_url)
    : null

  const handleModalClose = () => {
    if (saving || uploading) return
    onClose()
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
          <div onClick={handleModalClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
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
              <button onClick={handleModalClose} disabled={saving || uploading} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:cursor-not-allowed disabled:opacity-50">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-200"
                      onError={() => setForm((p) => ({ ...p, avatar_url: '' }))}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-2xl">
                      {form.name ? getInitials(form.name) : <Camera className="w-8 h-8" />}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !member}
                  className={cn(
                    'text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1',
                    (!member || uploading) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading...' : member ? 'Upload photo' : 'Save first to upload photo'}
                </button>
              </div>

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
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="">Select role</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Avatar URL (manual fallback) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Avatar URL</label>
                <input
                  type="url"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://... (or use Upload above)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Active</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    form.is_active ? 'bg-amber-500' : 'bg-slate-200'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      form.is_active ? 'left-5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleModalClose} disabled={saving || uploading} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50">
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
