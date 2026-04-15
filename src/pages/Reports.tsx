import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, Loader2 } from 'lucide-react'
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import Papa from 'papaparse'
import type { Casting } from '@/types'
import { endOfDay, endOfMonth, endOfQuarter, endOfWeek, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfQuarter, startOfWeek, subDays } from 'date-fns'

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
const CLOSED_STATUSES = new Set(['WON', 'LOST', 'INVOICED', 'PAID', 'COMPLETED', 'DECLINED'])

const formatRevenueAxisValue = (value: number) => {
  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`
  }
  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
  }
  return `₹${value}`
}

export function Reports() {
  const [castings, setCastings] = useState<Casting[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | '30days' | 'quarter' | 'custom'>('month')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })

  const isCustomRangeIncomplete = dateRange === 'custom' && (!customRange.from || !customRange.to)

  const fetchCastings = async () => {
    try {
      const data = await api.get('/castings')
      setCastings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch:', err)
      setCastings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCastings()
  }, [])

  // Filter by date range using shoot_date_start
  const filteredCastings = castings.filter((c) => {
    if (!c.shoot_date_start) return false
    const shootDate = parseISO(c.shoot_date_start)
    const now = new Date()

    if (dateRange === 'week') {
      return isWithinInterval(shootDate, { start: startOfWeek(now), end: endOfWeek(now) })
    }
    if (dateRange === 'month') {
      return isWithinInterval(shootDate, { start: startOfMonth(now), end: endOfMonth(now) })
    }
    if (dateRange === '30days') {
      return isWithinInterval(shootDate, { start: startOfDay(subDays(now, 29)), end: endOfDay(now) })
    }
    if (dateRange === 'quarter') {
      return isWithinInterval(shootDate, { start: startOfQuarter(now), end: endOfQuarter(now) })
    }
    if (dateRange === 'custom') {
      if (!customRange.from || !customRange.to) return false
      const from = startOfDay(parseISO(customRange.from))
      const to = endOfDay(parseISO(customRange.to))
      return isWithinInterval(shootDate, { start: from, end: to })
    }
    return true
  })

  // Casting Performance - Scheduled vs Closed per week
  const getWeeklyData = () => {
    const weeks: { [key: string]: { scheduled: number; closed: number } } = {}
    filteredCastings.forEach((c) => {
      if (!c.shoot_date_start) return
      const date = parseISO(c.shoot_date_start)
      const weekStart = startOfWeek(date)
      const weekKey = weekStart.toISOString().split('T')[0]
      if (!weeks[weekKey]) weeks[weekKey] = { scheduled: 0, closed: 0 }
      weeks[weekKey].scheduled++
      if (CLOSED_STATUSES.has((c.status || '').trim().toUpperCase())) weeks[weekKey].closed++
    })
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...data,
      }))
  }

  // Status Distribution
  const getStatusData = () => {
    const status: { [key: string]: number } = {}
    filteredCastings.forEach((c) => {
      const s = c.status || 'Unknown'
      status[s] = (status[s] || 0) + 1
    })
    return Object.entries(status).map(([name, value]) => ({ name, value }))
  }

  const getAssignedNames = (casting: Casting) => {
    const assignedTo = casting.assigned_to as Array<string | { name?: string | null }> | undefined
    if (Array.isArray(assignedTo)) {
      const names = assignedTo
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name || '').trim())
        .filter(Boolean)
      if (names.length > 0) return names
    }

    if (casting.assigned_names) {
      return casting.assigned_names.split(',').map((name) => name.trim()).filter(Boolean)
    }

    return []
  }

  // Team Performance
  const getTeamData = () => {
    const team: { [key: string]: number } = {}
    filteredCastings.forEach((c) => {
      getAssignedNames(c).forEach((name) => {
        team[name] = (team[name] || 0) + 1
      })
    })
    return Object.entries(team)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))
  }

  // Revenue Trend
  const getRevenueData = () => {
    const months: { [key: string]: { label: string; revenue: number } } = {}
    filteredCastings.forEach((c) => {
      if (!c.shoot_date_start || !c.budget_max) return
      const date = new Date(c.shoot_date_start)
      const monthKey = c.shoot_date_start.slice(0, 7)
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!months[monthKey]) months[monthKey] = { label, revenue: 0 }
      months[monthKey].revenue += c.budget_max || 0
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, value]) => ({ month: value.label, revenue: value.revenue }))
  }

  const exportCSV = () => {
    const csv = Papa.unparse(filteredCastings.map((c) => ({
      Project: c.project_name,
      Client: c.client_name,
      Status: c.status,
      Source: c.source,
      Shoot_Date: c.shoot_date_start,
      Budget_Min: c.budget_min,
      Budget_Max: c.budget_max,
      Location: c.location,
      Assigned_To: getAssignedNames(c).join('; '),
      Created: c.created_at,
    })))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `castings-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">Analytics and insights for your castings</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filteredCastings.length === 0 || isCustomRangeIncomplete}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'quarter', label: 'This Quarter' },
            { id: 'custom', label: 'Custom' },
          ].map((range) => (
            <button
              key={range.id}
              onClick={() => setDateRange(range.id as typeof dateRange)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                dateRange === range.id
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              {range.label}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          )}
        </div>
        {isCustomRangeIncomplete ? (
          <p className="text-sm text-amber-600">
            Select both custom dates to generate a report.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            {filteredCastings.length} {filteredCastings.length === 1 ? 'casting' : 'castings'} in this report range
          </p>
        )}
      </div>

      {filteredCastings.length === 0 ? (
        <div className="card p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No castings in this date range</h3>
          <p className="mt-2 text-sm text-slate-500">
            Try a broader range or adjust the custom dates to see report data.
          </p>
        </div>
      ) : (
      /* Charts */
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Casting Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <h3 className="font-semibold text-slate-900 mb-4">Casting Performance</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getWeeklyData()}>
                <XAxis dataKey="week" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Bar dataKey="scheduled" name="Scheduled" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <h3 className="font-semibold text-slate-900 mb-4">Status Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getStatusData()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {getStatusData().map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Team Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5"
        >
          <h3 className="font-semibold text-slate-900 mb-4">Team Performance</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getTeamData()} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={80} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" name="Castings" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Revenue Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getRevenueData()}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatRevenueAxisValue(value as number)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                  }}
                  formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
      )}
    </div>
  )
}
