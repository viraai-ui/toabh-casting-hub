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
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
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

  const fetchDashboard = async () => {
    try {
      setError(null)
      const data = await api.get('/dashboard')
      setStats(data)
    } catch (err) {
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
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="w-10 h-10 bg-slate-200 rounded-xl mb-3" />
              <div className="h-4 bg-slate-200 rounded w-20 mb-2" />
              <div className="h-8 bg-slate-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline Chart */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Pipeline Overview</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Monthly Trend</h3>
          <div className="h-[200px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#f59e0b"
                    strokeWidth={2}
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
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {stats?.recent_activity?.slice(0, 8).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  activity.action === 'CREATED' ? 'bg-green-100 text-green-600' :
                  activity.action === 'STATUS_CHANGE' || activity.action === 'STATUS_CHANGED' ? 'bg-blue-100 text-blue-600' :
                  activity.action === 'ASSIGNED' ? 'bg-purple-100 text-purple-600' :
                  activity.action === 'NOTE' ? 'bg-amber-100 text-amber-600' :
                  'bg-slate-100 text-slate-600'
                )}>
                  {activity.action === 'CREATED' && <Plus className="w-4 h-4" />}
                  {activity.action === 'STATUS_CHANGE' && <TrendingUp className="w-4 h-4" />}
                  {activity.action === 'ASSIGNED' && <Users className="w-4 h-4" />}
                  {activity.action === 'NOTE' && <MessageSquare className="w-4 h-4" />}
                  {activity.action === 'UPDATED' && <RefreshCw className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{activity.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activity.user_name} • {formatRelativeTime(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/castings?new=true')}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">New Casting</span>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <Search className="w-5 h-5" />
              <span className="font-medium">Search</span>
            </button>
            <button
              onClick={() => navigate('/calendar')}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Calendar</span>
            </button>
          </div>
        </div>

        {/* Team Workload */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Team Workload</h3>
          <div className="space-y-3">
            {stats?.workload?.slice(0, 6).map((member: { id?: number; name: string; count: number }, i: number) => {
              const maxCount = Math.max(...(stats?.workload?.map((m: { count: number }) => m.count) || [1]))
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium">
                        {getInitials(member.name)}
                      </div>
                      <span className="text-sm text-slate-700">{member.name}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-900">{member.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all"
                      style={{ width: `${(member.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
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
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== 0 && (
          <div className={cn(
            'flex items-center gap-0.5 text-sm font-medium',
            trend > 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {trend > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </motion.div>
  )
}
