import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Camera, KeyRound, Loader2, Mail, Save, Trash2, User } from 'lucide-react'
import { api, toApiUrl } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import type { UserProfile } from '@/types'
import { toast } from 'sonner'

const EMPTY_STATS = {
  total_jobs: 0,
  active_jobs: 0,
  completed_jobs: 0,
  pending_tasks: 0,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const infoSectionRef = useRef<HTMLDivElement | null>(null)

  const applyCurrentUser = (data: UserProfile) => {
    setCurrentUser({
      name: data.name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      avatar: data.avatar_url,
      date_of_birth: data.date_of_birth,
      team_member_id: data.team_member_id,
    })
  }

  const loadProfile = async () => {
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
  }

  useEffect(() => {
    void loadProfile()
  }, [])

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
    { label: 'Total Jobs', value: profile.stats?.total_jobs ?? 0 },
    { label: 'Active Jobs', value: profile.stats?.active_jobs ?? 0 },
    { label: 'Completed Jobs', value: profile.stats?.completed_jobs ?? 0 },
    { label: 'Pending Tasks', value: profile.stats?.pending_tasks ?? 0 },
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
              onClick={() => toast.info('Password change can be added next.')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4" />
              Change Password
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
              <div key={card.label} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 min-w-0">
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
              <h2 className="text-sm font-semibold text-slate-900">Activity Summary</h2>
              <div className="mt-4 space-y-3">
                {profile.recent_activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">No recent activity yet.</div>
                ) : profile.recent_activity.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium text-slate-800">{item.description || item.action}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(item.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.user_name} • {formatDate(item.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-semibold text-slate-900">My Tasks</h2>
              <div className="mt-4 space-y-3">
                {profile.tasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">No assigned items right now.</div>
                ) : profile.tasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{task.project_name || 'Untitled Job'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{task.client_name || 'No client'}</span>
                          {task.shoot_date_start && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(task.shoot_date_start)}</span>}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">{task.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
