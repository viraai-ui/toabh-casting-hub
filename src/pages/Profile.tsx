import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Camera, KeyRound, Loader2, Mail, Save, Trash2, User } from 'lucide-react'
import { api, toApiUrl } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { UserProfile } from '@/types'
import { toast } from 'sonner'

type TaskFilter = 'all' | 'pending' | 'overdue'

const EMPTY_STATS = {
  total_jobs: 0,
  active_jobs: 0,
  completed_jobs: 0,
  pending_tasks: 0,
  overdue_tasks: 0,
}

const EMPTY_PROFILE: UserProfile = {
  name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  role: 'Admin',
  avatar_url: '',
  team_member_id: null,
  stats: EMPTY_STATS,
  recent_activity: [],
  tasks: [],
}

function ProfileAvatar({ name, avatarUrl, size = 'h-20 w-20' }: { name: string; avatarUrl?: string | null; size?: string }) {
  const [imgError, setImgError] = useState(false)
  const src = avatarUrl ? toApiUrl(avatarUrl) : null

  if (src && !imgError) {
    return <img src={src} alt={name} onError={() => setImgError(true)} className={cn(size, 'rounded-3xl object-cover bg-slate-100')} />
  }

  return (
    <div className={cn(size, 'flex items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-xl font-semibold text-white')}>
      {getInitials(name || 'U')}
    </div>
  )
}

export function Profile() {
  const { setCurrentUser } = useAppStore()
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE)
  const [form, setForm] = useState({ name: '', email: '', phone: '', date_of_birth: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const infoSectionRef = useRef<HTMLDivElement | null>(null)

  const isOverdue = (task: UserProfile['tasks'][number]) => {
    const dueDate = task.due_date || task.shoot_date_start
    if (!dueDate) return false
    if (task.status === 'WON' || task.status === 'PAID' || task.status === 'COMPLETED') return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(dueDate) < today
  }

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return profile.tasks
    if (taskFilter === 'overdue') return profile.tasks.filter(isOverdue)
    return profile.tasks.filter((t) => t.status !== 'WON' && t.status !== 'PAID' && t.status !== 'COMPLETED')
  }, [profile.tasks, taskFilter])

  const taskCounts = useMemo(() => ({
    all: profile.tasks.length,
    pending: profile.tasks.filter((t) => t.status !== 'WON' && t.status !== 'PAID' && t.status !== 'COMPLETED').length,
    overdue: profile.tasks.filter(isOverdue).length,
  }), [profile.tasks])

  const taskFilterConfig: { key: TaskFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Tasks', count: taskCounts.all },
    { key: 'pending', label: 'Pending Tasks', count: taskCounts.pending },
    { key: 'overdue', label: 'Overdue Tasks', count: taskCounts.overdue },
  ]

  const applyCurrentUser = useCallback((data: UserProfile) => {
    setCurrentUser({
      name: data.name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      avatar: data.avatar_url,
      date_of_birth: data.date_of_birth,
      team_member_id: data.team_member_id,
    })
  }, [setCurrentUser])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/profile') as UserProfile
      setProfile(data)
      setForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        date_of_birth: data.date_of_birth || '',
      })
      applyCurrentUser(data)
    } catch (err) {
      console.error('Failed to load profile', err)
      setError('Could not load profile.')
    } finally {
      setLoading(false)
    }
  }, [applyCurrentUser])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useDataRefresh(() => {
    void loadProfile()
  })

  const saveProfile = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const updated = await api.put('/profile', form) as UserProfile
      setProfile(updated)
      applyCurrentUser(updated)
      setMessage('Profile saved.')
    } catch (err) {
      console.error('Failed to save profile', err)
      setError('Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  const onAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const updated = await api.upload('/profile/avatar', formData) as UserProfile
      setProfile(updated)
      applyCurrentUser(updated)
      setMessage('Profile picture updated.')
    } catch (err) {
      console.error('Failed to upload avatar', err)
      setError('Could not update profile picture.')
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const removeAvatar = async () => {
    setUploadingAvatar(true)
    setError(null)
    try {
      const updated = await api.del('/profile/avatar') as UserProfile
      setProfile(updated)
      applyCurrentUser(updated)
      setMessage('Profile picture removed.')
    } catch (err) {
      console.error('Failed to remove avatar', err)
      setError('Could not remove profile picture.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const statCards = useMemo(() => [
    { label: 'Total Jobs', value: profile.stats?.total_jobs ?? 0, note: 'All jobs connected to your account view.', tone: 'border-slate-200/70 bg-slate-50 text-slate-700' },
    { label: 'Active Jobs', value: profile.stats?.active_jobs ?? 0, note: 'Live work still moving through execution.', tone: 'border-amber-200/70 bg-amber-50 text-amber-700' },
    { label: 'Completed Jobs', value: profile.stats?.completed_jobs ?? 0, note: 'Jobs already closed out successfully.', tone: 'border-emerald-200/70 bg-emerald-50 text-emerald-700' },
    { label: 'Pending Tasks', value: profile.stats?.pending_tasks ?? 0, note: 'Follow-ups still needing your attention.', tone: 'border-blue-200/70 bg-blue-50 text-blue-700' },
  ], [profile.stats])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <ProfileAvatar name={profile.name} avatarUrl={profile.avatar_url} size="h-20 w-20 sm:h-24 sm:w-24" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Profile</p>
              <h1 className="mt-1 truncate text-2xl font-semibold text-slate-900">{profile.name || 'My Profile'}</h1>
              <p className="mt-1 text-sm text-slate-500">{profile.role}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{profile.email || 'Email not added yet'}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{profile.phone || 'Phone not added yet'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => infoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <User className="h-4 w-4" />
              Edit Profile
            </button>
            <button
              onClick={() => {
                setMessage(null)
                setError(null)
                setPasswordOpen((current) => !current)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4" />
              {passwordOpen ? 'Close Password' : 'Change Password'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900">Profile Photo</h2>
            </div>

            <div className="mt-5 flex flex-col items-start gap-4">
              <ProfileAvatar name={profile.name} avatarUrl={profile.avatar_url} size="h-24 w-24" />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <Camera className="h-4 w-4" />
                  {uploadingAvatar ? 'Updating...' : 'Change Photo'}
                </button>
                <button onClick={removeAvatar} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {statCards.map((card) => (
              <div key={card.label} className={cn('rounded-[24px] border p-4 shadow-sm', card.tone)}>
                <p className="text-xs font-medium uppercase tracking-wide text-current/75">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{card.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          {passwordOpen && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Password & access</h2>
                  <p className="mt-1 text-sm text-slate-500">Update your password directly from profile, no placeholder action.</p>
                </div>
                <button
                  onClick={async () => {
                    setMessage(null)
                    setError(null)
                    if (!passwordForm.new_password || passwordForm.new_password.length < 6) {
                      setError('Password must be at least 6 characters.')
                      return
                    }
                    if (passwordForm.new_password !== passwordForm.confirm_password) {
                      setError('New password and confirm password do not match.')
                      return
                    }
                    setPasswordSaving(true)
                    try {
                      await api.put('/profile/password', {
                        current_password: passwordForm.current_password,
                        new_password: passwordForm.new_password,
                      })
                      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
                      setMessage('Password updated successfully.')
                      toast.success('Password updated')
                      setPasswordOpen(false)
                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : 'Could not update password.'
                      setError(errorMessage)
                    } finally {
                      setPasswordSaving(false)
                    }
                  }}
                  disabled={passwordSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {passwordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Current Password</label>
                  <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm((current) => ({ ...current, current_password: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">New Password</label>
                  <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm((current) => ({ ...current, new_password: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Confirm Password</label>
                  <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm((current) => ({ ...current, confirm_password: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
                </div>
              </div>
            </div>
          )}

          <div ref={infoSectionRef} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900">Basic Info</h2>
              </div>
              <button onClick={saveProfile} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Name</label>
                <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Phone</label>
                <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Date of Birth</label>
                <input type="date" value={form.date_of_birth || ''} onChange={(e) => setForm((current) => ({ ...current, date_of_birth: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
              </div>
            </div>

            <div className="mt-4 min-h-5">
              {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
              {error && <p className="text-sm font-medium text-red-500">{error}</p>}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Activity Summary</h2>
                  <p className="mt-1 text-sm text-slate-500">Recent movement tied to your account and workflow.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {profile.recent_activity.length} item{profile.recent_activity.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {profile.recent_activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Personal activity</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">No recent activity yet</p>
                    <p className="mt-2 text-sm text-slate-500">New movement tied to your account will show up here as the workspace becomes active.</p>
                  </div>
                ) : profile.recent_activity.map((item) => {
                  const activityUserName = item.user_name?.trim() || 'System'
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 text-sm font-medium text-slate-800">{item.description || item.action}</p>
                        <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(item.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{activityUserName} • {formatDate(item.created_at)}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {taskFilterConfig.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTaskFilter(item.key)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all duration-200',
                      taskFilter === item.key
                        ? 'border-amber-300 bg-amber-50/70 shadow-md'
                        : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow',
                    )}
                  >
                    <span className="text-2xl font-semibold text-slate-900">{item.count}</span>
                    <span className={cn(
                      'mt-1 text-xs font-medium',
                      taskFilter === item.key ? 'text-amber-700' : 'text-slate-500',
                    )}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">My task queue</h2>
                    <p className="mt-1 text-sm text-slate-500">A cleaner read of personal follow-ups and due items.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {filteredTasks.length} visible
                  </div>
                </div>
                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">My queue</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">No tasks in this category</p>
                      <p className="mt-2 text-sm text-slate-500">Shift the filter or add the next follow-up to bring your personal queue into view.</p>
                    </div>
                  ) : filteredTasks.map((task) => {
                    const overdue = isOverdue(task)
                    return (
                      <div key={task.id} className={cn(
                        'rounded-2xl border px-4 py-3 transition-colors duration-150',
                        overdue ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-slate-50',
                      )}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{task.project_name || 'Untitled Job'}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{task.client_name || 'Client not added yet'}</span>
                              {(task.due_date || task.shoot_date_start) && <span className={cn('inline-flex items-center gap-1', overdue && 'text-red-500')}><Calendar className="h-3 w-3" />{formatDate(task.due_date || task.shoot_date_start)}</span>}
                            </div>
                          </div>
                          <span className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-medium',
                            overdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-50 text-amber-700',
                          )}>{overdue ? 'Overdue' : task.status}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
