import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckSquare,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Star,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatRelativeTime, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { DashboardStats } from '@/types'

type TodayCard = {
  label: string
  value: number
  note: string
  icon: typeof Briefcase
  tone: string
}

export function Dashboard() {
  const navigate = useNavigate()
  const { setSearchOpen } = useAppStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'refresh') setRefreshing(true)
      setError(null)
      const data = await api.get('/dashboard')
      setStats(data)
      setLastUpdated(new Date())
    } catch {
      setError('Failed to load today view')
    } finally {
      setLoading(false)
      if (mode === 'refresh') setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchDashboard('initial')
    const interval = window.setInterval(() => void fetchDashboard('refresh'), 20000)
    return () => window.clearInterval(interval)
  }, [])

  useDataRefresh(() => {
    void fetchDashboard('refresh')
  })

  const recentActivity = useMemo(() => {
    const source = (stats as { recent_activity?: Array<{ id: number; description: string; action: string; user_name: string; created_at: string }> })?.recent_activity
      ?? stats?.recent_activities
      ?? []
    return source.slice(0, 6)
  }, [stats])

  const workload = useMemo(() => {
    return ((stats as { workload?: Array<{ name?: string | null; count: number }> })?.workload ?? []).slice(0, 5)
  }, [stats])

  const pipeline = useMemo(() => {
    const source = (stats as { pipeline?: Array<{ status?: string; name?: string; count: number }> })?.pipeline
      ?? stats?.pipeline_by_stage?.map((item) => ({ name: item.stage, count: item.count }))
      ?? []

    return source
      .map((item) => ({
        name: item.status || item.name || 'Unknown',
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [stats])

  const todayCards: TodayCard[] = [
    {
      label: 'Active jobs',
      value: stats?.active_castings ?? 0,
      note: 'Live work that needs monitoring',
      icon: Briefcase,
      tone: 'bg-amber-50 text-amber-700 border-amber-200/70',
    },
    {
      label: 'Pending tasks',
      value: stats?.pending_tasks ?? 0,
      note: 'Follow-ups and confirmations still open',
      icon: CheckSquare,
      tone: 'bg-blue-50 text-blue-700 border-blue-200/70',
    },
    {
      label: 'Open pipeline',
      value: pipeline.reduce((sum, item) => sum + item.count, 0),
      note: 'Across the busiest current stages',
      icon: Star,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    },
    {
      label: 'Tracked clients',
      value: (stats as { total_clients?: number })?.total_clients ?? 0,
      note: 'Relationship layer ready for action',
      icon: Users,
      tone: 'bg-purple-50 text-purple-700 border-purple-200/70',
    },
  ]

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-4 text-slate-500">{error}</p>
        <button onClick={() => void fetchDashboard('refresh')} className="btn-primary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Today
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              The operating view for what needs attention now.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 1 starts here, less dashboard theatre, more urgency, movement, and next actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last updated</div>
              <div className="mt-1 font-medium text-slate-700">
                {lastUpdated ? formatRelativeTime(lastUpdated.toISOString()) : 'Just now'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void fetchDashboard('refresh')}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing...' : 'Refresh now'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {todayCards.map((card) => (
          <section key={card.label} className={cn('rounded-3xl border p-5 shadow-sm', card.tone)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{card.note}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Urgent focus</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">What the team should touch first</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Open tasks
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <FocusCard
              icon={AlertCircle}
              title="Pending confirmations"
              value={stats?.pending_tasks ?? 0}
              description="Anything waiting on a callback, reply, or internal follow-up should move first."
              actionLabel="Review tasks"
              onClick={() => navigate('/tasks')}
            />
            <FocusCard
              icon={Calendar}
              title="Schedule pressure"
              value={stats?.active_castings ?? 0}
              description="Live jobs and date-sensitive work should be checked against the calendar every morning."
              actionLabel="Open calendar"
              onClick={() => navigate('/calendar')}
            />
            <FocusCard
              icon={Star}
              title="Pipeline movement"
              value={pipeline[0]?.count ?? 0}
              description={pipeline[0] ? `${pipeline[0].name} is the heaviest stage right now.` : 'Pipeline data will appear here once jobs start moving.'}
              actionLabel="Open jobs"
              onClick={() => navigate('/castings')}
            />
            <FocusCard
              icon={Users}
              title="Team ownership"
              value={workload.length}
              description={workload.length > 0 ? 'See who is carrying active work and where handoffs may be needed.' : 'Assignments will populate here as soon as jobs are owned by the team.'}
              actionLabel="Open team"
              onClick={() => navigate('/team')}
            />
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Quick actions</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Fast paths for daily ops</h2>
          <div className="mt-5 grid gap-3">
            <ActionButton
              icon={Plus}
              title="New job"
              description="Start a fresh brief without hunting through the app."
              onClick={() => window.dispatchEvent(new CustomEvent('toabh-global-action', { detail: { action: 'open-casting-modal' } }))}
            />
            <ActionButton
              icon={Search}
              title="Search everything"
              description="Jump straight to jobs, clients, talent, and records."
              onClick={() => setSearchOpen(true)}
            />
            <ActionButton
              icon={Calendar}
              title="Open agenda"
              description="Check today, next 7 days, and date-sensitive work."
              onClick={() => navigate('/calendar')}
            />
            <ActionButton
              icon={Star}
              title="Browse talent"
              description="Get to the visual roster faster from the new foundation nav."
              onClick={() => navigate('/talents')}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Inbox</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Recent movement</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/activity')}
              className="text-sm font-medium text-amber-700 transition hover:text-amber-800"
            >
              View full inbox
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState
              title="No fresh activity yet"
              description="New job movement, notes, and updates will land here as the team starts operating. Build the first job to wake up the inbox."
              ctaLabel="Create a job"
              onClick={() => window.dispatchEvent(new CustomEvent('toabh-global-action', { detail: { action: 'open-casting-modal' } }))}
            />
          ) : (
            <div className="mt-5 space-y-3">
              {recentActivity.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => navigate('/activity')}
                  className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-left transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-6 text-slate-800">{summarizeActivity(activity.description ?? '')}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {activity.user_name || 'System'} • {formatRelativeTime(activity.created_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pipeline snapshot</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Where the current work sits</h2>
            {pipeline.length === 0 ? (
              <EmptyState
                title="No active pipeline yet"
                description="As jobs move through stages, this space will become the high-level morning scan. Once the first job is live, pipeline health will show up here."
                ctaLabel="Open jobs"
                onClick={() => navigate('/castings')}
              />
            ) : (
              <div className="mt-5 space-y-3">
                {pipeline.map((stage, index) => {
                  const maxCount = Math.max(...pipeline.map((item) => item.count), 1)
                  return (
                    <div key={stage.name} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-800">{index + 1}. {stage.name}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {stage.count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600"
                          style={{ width: `${Math.max((stage.count / maxCount) * 100, 10)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Team load</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Who is carrying active work</h2>
            {workload.length === 0 ? (
              <EmptyState
                title="No assignments yet"
                description="Once jobs are distributed, this will show who is overloaded and who has room. Assign ownership to turn this into a real load view."
                ctaLabel="Open team"
                onClick={() => navigate('/team')}
              />
            ) : (
              <div className="mt-5 space-y-3">
                {workload.map((member, index) => {
                  const maxCount = Math.max(...workload.map((item) => item.count), 1)
                  const name = member.name?.trim() || 'Unassigned'
                  return (
                    <div key={`${name}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-semibold text-white">
                            {getInitials(name)}
                          </div>
                          <span className="truncate text-sm font-medium text-slate-800">{name}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{member.count}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-900"
                          style={{ width: `${Math.max((member.count / maxCount) * 100, 10)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </motion.div>
  )
}

function summarizeActivity(description: string) {
  return description
    .replace('Status changed from ', '')
    .replace('Talents Shortlisted', 'Shortlisted')
    .replace('Options Sent', 'Options sent')
    .replace('Casting created: ', 'Created • ')
    .replace('Team reassigned', 'Team reassigned')
}

function FocusCard({
  icon: Icon,
  title,
  value,
  description,
  actionLabel,
  onClick,
}: {
  icon: typeof AlertCircle
  title: string
  value: number
  description: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
          {value}
        </div>
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <button type="button" onClick={onClick} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-700 transition hover:text-amber-800">
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Plus
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  )
}

function EmptyState({
  title,
  description,
  ctaLabel,
  onClick,
}: {
  title: string
  description: string
  ctaLabel: string
  onClick: () => void
}) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-5 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
      >
        {ctaLabel}
      </button>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="card h-40" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-40 rounded-3xl bg-slate-200/80" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card h-80" />
        <div className="card h-80" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card h-80" />
        <div className="card h-80" />
      </div>
    </div>
  )
}
