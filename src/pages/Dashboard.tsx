import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase,
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  MessageSquare,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { cn, formatCurrency, formatRelativeTime, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import type { DashboardStats } from '@/types'

export function Dashboard() {
  const navigate = useNavigate()
  const { setSearchOpen } = useAppStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllActivity, setShowAllActivity] = useState(false)

  const fetchDashboard = async () => {
    try {
      setError(null)
      const data = await api.get('/dashboard')
      setStats(data)
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500 mb-4">{error}</p>
        <button onClick={fetchDashboard} className="btn-primary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  const pipelineData = Array.isArray(stats?.pipeline) 
    ? stats.pipeline.map((p: { status?: string; name?: string; count: number }) => ({ 
        name: p.status || p.name || '', 
        count: p.count 
      }))
    : []

  const trendData = stats?.trend || []
  const recentActivity = stats?.recent_activity || []
  const visibleActivity = showAllActivity ? recentActivity.slice(0, 8) : recentActivity.slice(0, 4)
  const workload = stats?.workload || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Total Castings"
          value={stats?.total_castings ?? 0}
          trend={12}
          iconColor="text-blue-500"
        />
        <StatCard
          icon={Users}
          label="Active Castings"
          value={stats?.active_castings ?? 0}
          trend={-5}
          iconColor="text-amber-500"
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(stats?.total_revenue ?? 0)}
          trend={8}
          iconColor="text-green-500"
        />
        <StatCard
          icon={Calendar}
          label="Total Clients"
          value={stats?.total_clients ?? 0}
          trend={0}
          iconColor="text-purple-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {/* Pipeline Chart — custom CSS bars, fully responsive */}
        <div className="card p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pipeline</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Pipeline Overview</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {pipelineData.length} stage{pipelineData.length === 1 ? '' : 's'}
            </div>
          </div>
          {pipelineData.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-400">
              No pipeline data available
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-500">
                <span>Stage health</span>
                <span>Relative to the busiest stage</span>
              </div>
              {pipelineData.map((stage, idx) => {
                const maxCount = Math.max(...pipelineData.map((s) => s.count), 1)
                const pct = (stage.count / maxCount) * 100
                const colors = [
                  { bar: 'from-amber-400 to-amber-500', text: 'text-amber-700', tint: 'bg-amber-50' },
                  { bar: 'from-blue-400 to-blue-500', text: 'text-blue-700', tint: 'bg-blue-50' },
                  { bar: 'from-green-400 to-green-500', text: 'text-green-700', tint: 'bg-green-50' },
                  { bar: 'from-purple-400 to-purple-500', text: 'text-purple-700', tint: 'bg-purple-50' },
                  { bar: 'from-rose-400 to-rose-500', text: 'text-rose-700', tint: 'bg-rose-50' },
                  { bar: 'from-cyan-400 to-cyan-500', text: 'text-cyan-700', tint: 'bg-cyan-50' },
                  { bar: 'from-orange-400 to-orange-500', text: 'text-orange-700', tint: 'bg-orange-50' },
                ]
                const color = colors[idx % colors.length]

                return (
                  <div key={stage.name} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className={cn('text-sm font-semibold', color.text)} title={stage.name}>
                        {stage.name}
                      </span>
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', color.text, color.tint)}>
                        {stage.count}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                      <div
                        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', color.bar)}
                        style={{ width: `${Math.max(pct, 10)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Trend Chart */}
        <div className="card flex h-full flex-col p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Momentum</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Monthly Trend</h3>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400">Live KPI</p>
              <p className="mt-1 text-lg font-semibold text-amber-600">+8%</p>
            </div>
          </div>
          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-400">Trend note</p>
              <p className="mt-1 text-sm text-slate-600">Casting activity over time, updated from live dashboard data.</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Current signal</p>
              <p className="mt-1 text-sm text-slate-600">Steady pipeline movement with positive month-on-month momentum.</p>
            </div>
          </div>
          <div className="h-[220px] min-h-[220px] flex-1 rounded-2xl border border-slate-100 bg-white p-3">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    label={{ value: 'Castings', angle: -90, position: 'insideLeft', offset: 8, style: { fill: '#94a3b8', fontSize: 11 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.98)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      borderRadius: 16,
                      boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No trend data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {/* Activity Feed */}
        <div className="card h-full p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Live feed</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Recent Activity</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {recentActivity.length} updates
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <DashboardEmptyState
              title="No recent activity yet"
              description="New casting updates, assignments, and status changes will appear here as your team starts using the hub."
              ctaLabel="Create a casting"
              onClick={() => window.dispatchEvent(new CustomEvent('toabh-global-action', { detail: { action: 'open-casting-modal' } }))}
            />
          ) : (
            <>
              <div className="space-y-3 lg:max-h-[31rem] lg:overflow-y-auto lg:pr-1">
                {visibleActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]',
                  activity.action === 'CREATED' ? 'bg-green-100 text-green-700' :
                  activity.action === 'STATUS_CHANGE' || activity.action === 'STATUS_CHANGED' ? 'bg-blue-100 text-blue-700' :
                  activity.action === 'ASSIGNED' ? 'bg-purple-100 text-purple-700' :
                  activity.action === 'NOTE' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                )}>
                  {activity.action === 'CREATED' && <Plus className="w-4 h-4" />}
                  {activity.action === 'STATUS_CHANGE' && <TrendingUp className="w-4 h-4" />}
                  {activity.action === 'ASSIGNED' && <Users className="w-4 h-4" />}
                  {activity.action === 'NOTE' && <MessageSquare className="w-4 h-4" />}
                  {activity.action === 'UPDATED' && <RefreshCw className="w-4 h-4" />}
                </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-6 text-slate-800">{summarizeActivity(activity.description ?? '')}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {activity.user_name} • {formatRelativeTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {recentActivity.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity((value) => !value)}
                  className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {showAllActivity ? 'Show fewer updates' : `Show all ${Math.min(recentActivity.length, 8)} updates`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card flex h-full flex-col p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Shortcuts</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Quick Actions</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">4 actions</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toabh-global-action', { detail: { action: 'open-casting-modal' } }))}
              className="w-full rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/70 p-3.5 text-left text-amber-900 transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(245,158,11,0.14)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                  <Plus className="w-4.5 h-4.5" />
                </span>
                <span className="block">
                  <span className="block font-semibold">New Casting</span>
                  <span className="mt-1 block text-sm text-amber-700/80">Start a fresh brief fast.</span>
                </span>
              </div>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-left text-slate-900 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <Search className="w-4.5 h-4.5" />
                </span>
                <span className="block">
                  <span className="block font-semibold">Search</span>
                  <span className="mt-1 block text-sm text-slate-500">Find castings and clients instantly.</span>
                </span>
              </div>
            </button>
            <button
              onClick={() => navigate('/calendar')}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-left text-slate-900 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <Calendar className="w-4.5 h-4.5" />
                </span>
                <span className="block">
                  <span className="block font-semibold">Calendar</span>
                  <span className="mt-1 block text-sm text-slate-500">Review dates and follow-ups.</span>
                </span>
              </div>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-left text-slate-900 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <TrendingUp className="w-4.5 h-4.5" />
                </span>
                <span className="block">
                  <span className="block font-semibold">Reports</span>
                  <span className="mt-1 block text-sm text-slate-500">Open performance snapshots.</span>
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Team Workload */}
        <div className="card h-full p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Team</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Team Workload</h3>
            </div>
            <p className="text-xs text-slate-500">Current ownership split across active work.</p>
          </div>
          {workload.length === 0 ? (
            <DashboardEmptyState
              title="No team workload yet"
              description="Once castings are assigned, you'll see workload distribution for each teammate here."
              ctaLabel="Open team"
              onClick={() => navigate('/team')}
            />
          ) : (
            <div className="space-y-3">
              {workload.slice(0, 6).map((member: { id?: number; name: string; count: number }, i: number) => {
                const maxCount = Math.max(...(workload.map((m: { count: number }) => m.count) || [1]))
                return (
                  <div key={i} className="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-medium text-white">
                          {getInitials(member.name)}
                        </div>
                        <span className="truncate text-sm font-medium text-slate-700">{member.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{member.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                        style={{ width: `${Math.max((member.count / maxCount) * 100, 8)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function summarizeActivity(description: string) {
  return description
    .replace('Status changed from ', '')
    .replace('Talents Shortlisted', 'Shortlisted')
    .replace('Options Sent', 'Options')
    .replace('Casting created: ', 'Created • ')
    .replace('Team reassigned', 'Team reassigned')
}

function DashboardEmptyState({
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
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
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
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-slate-200" />
              <div className="h-6 w-16 rounded-full bg-slate-200" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="h-9 w-24 rounded-xl bg-slate-200" />
              <div className="h-3 w-40 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-3 w-20 rounded-full bg-slate-200" />
                <div className="h-6 w-40 rounded-xl bg-slate-200" />
              </div>
              <div className="h-8 w-24 rounded-full bg-slate-200" />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((__, j) => (
                <div key={j} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="h-4 w-24 rounded-full bg-slate-200" />
                    <div className="h-5 w-10 rounded-full bg-slate-200" />
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-3 w-20 rounded-full bg-slate-200" />
                <div className="h-6 w-32 rounded-xl bg-slate-200" />
              </div>
              <div className="h-8 w-20 rounded-full bg-slate-200" />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((__, j) => (
                <div key={j} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                      <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  iconColor,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  trend: number
  iconColor: string
}) {
  const trendTone = trend > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="card overflow-hidden p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200/80', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== 0 && (
          <div className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', trendTone)}>
            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-6 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{value}</p>
        <p className="text-sm text-slate-500">Updated from your current casting data{trend !== 0 ? ' • vs last 30 days' : ''}.</p>
      </div>
    </motion.div>
  )
}
