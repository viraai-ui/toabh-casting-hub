import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit, ArrowRight, UserPlus, MessageSquare, Trash2, Loader2, Filter, Sparkles, Clock3 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { Activity, TeamMember } from '@/types'

const activityIcons: { [key: string]: React.ElementType } = {
  CREATED: Plus,
  UPDATED: Edit,
  STATUS_CHANGED: ArrowRight,
  STATUS_CHANGE: ArrowRight,
  ASSIGNED: UserPlus,
  COMMENTED: MessageSquare,
  DELETED: Trash2,
  NOTE: MessageSquare,
}

const activityColors: { [key: string]: string } = {
  CREATED: 'bg-green-100 text-green-600',
  UPDATED: 'bg-blue-100 text-blue-600',
  STATUS_CHANGED: 'bg-purple-100 text-purple-600',
  STATUS_CHANGE: 'bg-purple-100 text-purple-600',
  ASSIGNED: 'bg-amber-100 text-amber-600',
  COMMENTED: 'bg-cyan-100 text-cyan-600',
  DELETED: 'bg-red-100 text-red-600',
  NOTE: 'bg-slate-100 text-slate-600',
}

type ActivityFilters = {
  date_from?: string
  date_to?: string
  user_id?: string
  type?: string
}

const quickFilters = [
  { key: 'all', label: 'All activity', description: 'Full inbox feed' },
  { key: 'today', label: 'Today only', description: 'Fresh movement from today' },
  { key: 'ASSIGNED', label: 'Assignments', description: 'Ownership and handoff changes' },
  { key: 'COMMENTED', label: 'Comments', description: 'Notes and team discussion' },
  { key: 'STATUS_CHANGED', label: 'Status changes', description: 'Pipeline movement and decisions' },
] as const

export function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ActivityFilters>({})
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchActivities = useCallback(async (reset = false) => {
    try {
      const params = new URLSearchParams()
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.user_id) params.append('user_id', filters.user_id)
      if (filters.type) params.append('type', filters.type)
      params.append('page', reset ? '1' : String(page))
      params.append('limit', '20')

      const data = await api.get(`/activities?${params.toString()}`)
      const safeData = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { activities?: Activity[] }).activities)
          ? (data as { activities: Activity[] }).activities
          : []
      if (reset) {
        setActivities(safeData)
        setPage(1)
      } else {
        setActivities((prev) => [...prev, ...safeData])
      }
      setHasMore(safeData.length === 20)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [filters.date_from, filters.date_to, filters.user_id, filters.type, page])

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.get('/team')
      setTeam(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch team:', err)
      setTeam([])
    }
  }, [])

  useEffect(() => {
    void fetchTeam()
  }, [fetchTeam])

  useEffect(() => {
    setLoading(true)
    void fetchActivities(true)
  }, [fetchActivities, filters])

  useDataRefresh(() => {
    void fetchTeam()
    void fetchActivities(true)
  })

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (filters.date_from) params.append('date_from', filters.date_from)
        if (filters.date_to) params.append('date_to', filters.date_to)
        if (filters.user_id) params.append('user_id', filters.user_id)
        if (filters.type) params.append('type', filters.type)
        params.append('page', String(nextPage))
        params.append('limit', '20')
        const data = await api.get(`/activities?${params.toString()}`)
        const safeData = Array.isArray(data)
          ? data
          : data && typeof data === 'object' && Array.isArray((data as { activities?: Activity[] }).activities)
            ? (data as { activities: Activity[] }).activities
            : []
        setActivities((prev) => [...prev, ...safeData])
        setHasMore(safeData.length === 20)
      } catch (err) {
        console.error('Failed to load more activities:', err)
      }
    })()
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  const inboxStats = useMemo(() => {
    const todayCount = activities.filter((activity) => activity.created_at?.slice(0, 10) === todayKey).length
    const assignmentCount = activities.filter((activity) => activity.action === 'ASSIGNED').length
    const commentCount = activities.filter((activity) => activity.action === 'COMMENTED' || activity.action === 'NOTE').length
    const systemCount = activities.filter((activity) => !(activity.user_name || '').trim() || (activity.user_name || '').trim() === 'System').length

    return { todayCount, assignmentCount, commentCount, systemCount }
  }, [activities, todayKey])

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const activeQuickFilter = useMemo(() => {
    if (filters.type === 'ASSIGNED') return 'ASSIGNED'
    if (filters.type === 'COMMENTED') return 'COMMENTED'
    if (filters.type === 'STATUS_CHANGED') return 'STATUS_CHANGED'
    if (filters.date_from === todayKey && filters.date_to === todayKey && !filters.type) return 'today'
    return 'all'
  }, [filters.date_from, filters.date_to, filters.type, todayKey])

  const applyQuickFilter = (key: (typeof quickFilters)[number]['key']) => {
    if (key === 'all') {
      setFilters((prev) => ({ ...prev, date_from: undefined, date_to: undefined, type: undefined }))
      return
    }

    if (key === 'today') {
      setFilters((prev) => ({ ...prev, date_from: todayKey, date_to: todayKey, type: undefined }))
      return
    }

    setFilters((prev) => ({ ...prev, type: key === 'STATUS_CHANGED' ? 'STATUS_CHANGED' : key, date_from: undefined, date_to: undefined }))
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Inbox
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              Recent movement, decisions, and team activity.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 1 reframes this page as the workspace inbox, a cleaner feed of what changed and who touched it.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Feed size</div>
            <div className="mt-1 font-medium text-slate-800">{activities.length} loaded item{activities.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InboxStatCard
          label="Moved today"
          value={inboxStats.todayCount}
          note="Fresh activity from the current day."
          tone="border-amber-200/70 bg-amber-50 text-amber-700"
          icon={Sparkles}
        />
        <InboxStatCard
          label="Assignments"
          value={inboxStats.assignmentCount}
          note="Ownership changes and handoffs in the loaded feed."
          tone="border-blue-200/70 bg-blue-50 text-blue-700"
          icon={UserPlus}
        />
        <InboxStatCard
          label="Comments + notes"
          value={inboxStats.commentCount}
          note="Conversation and context added by the team."
          tone="border-cyan-200/70 bg-cyan-50 text-cyan-700"
          icon={MessageSquare}
        />
        <InboxStatCard
          label="System generated"
          value={inboxStats.systemCount}
          note="Automatic updates that still need a human glance."
          tone="border-slate-200/70 bg-slate-50 text-slate-600"
          icon={Clock3}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick inbox filters</p>
            <p className="mt-1 text-sm text-slate-600">Jump straight to the part of the feed you need.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((option) => {
              const active = activeQuickFilter === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyQuickFilter(option.key)}
                  className={cn(
                    'rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  title={option.description}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <div className="card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
              placeholder="To"
            />
            <select
              value={filters.user_id || ''}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
            >
              <option value="">All teammates</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
            >
              <option value="">All activity types</option>
              <option value="CREATED">Created</option>
              <option value="UPDATED">Updated</option>
              <option value="STATUS_CHANGED">Status changed</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="COMMENTED">Commented</option>
              <option value="DELETED">Deleted</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {activeFilterCount === 0 ? 'No advanced filters' : `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`}
            </div>
            {(filters.date_from || filters.date_to || filters.user_id || filters.type) && (
              <button
                onClick={() => setFilters({})}
                className="text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && activities.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">No inbox activity found</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Try widening the filters or switch back to the full activity feed.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.action] || MessageSquare
              const colorClass = activityColors[activity.action] || 'bg-slate-100 text-slate-600'
              const activityUserName = activity.user_name?.trim() || 'System'

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorClass)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em]',
                          colorClass
                        )}>
                          {(activity.action || 'Unknown').replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">#{activity.id}</span>
                      </div>
                      <p className="mt-2 text-slate-700">{activity.description}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium">
                            {getInitials(activityUserName)}
                          </div>
                          {activityUserName}
                        </span>
                        <span>•</span>
                        <span>{formatDate(activity.created_at)}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(activity.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                className="btn-secondary"
              >
                Load more activity
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InboxStatCard({
  label,
  value,
  note,
  tone,
  icon: Icon,
}: {
  label: string
  value: number
  note: string
  tone: string
  icon: React.ElementType
}) {
  return (
    <div className={cn('rounded-3xl border p-5 shadow-sm', tone)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-current/80">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  )
}
