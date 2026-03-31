import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit, ArrowRight, UserPlus, MessageSquare, Trash2, Loader2, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
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

export function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{
    date_from?: string
    date_to?: string
    user_id?: string
    type?: string
  }>({})
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchActivities = async (reset = false) => {
    try {
      const params = new URLSearchParams()
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.user_id) params.append('user_id', filters.user_id)
      if (filters.type) params.append('type', filters.type)
      params.append('page', reset ? '1' : String(page))
      params.append('limit', '20')

      const data = await api.get(`/activities?${params.toString()}`)
      if (reset) {
        setActivities(data)
        setPage(1)
      } else {
        setActivities((prev) => [...prev, ...data])
      }
      setHasMore(data.length === 20)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeam = async () => {
    try {
      const data = await api.get('/team')
      setTeam(data)
    } catch (err) {
      console.error('Failed to fetch team:', err)
    }
  }

  useEffect(() => {
    fetchTeam()
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchActivities(true)
  }, [filters])

  const handleLoadMore = () => {
    setPage((p) => p + 1)
    fetchActivities()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
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
            <option value="">All Users</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={filters.type || ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
          >
            <option value="">All Types</option>
            <option value="CREATED">Created</option>
            <option value="UPDATED">Updated</option>
            <option value="STATUS_CHANGED">Status Changed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="COMMENTED">Commented</option>
            <option value="DELETED">Deleted</option>
          </select>
          {(filters.date_from || filters.date_to || filters.user_id || filters.type) && (
            <button
              onClick={() => setFilters({})}
              className="text-sm text-amber-600 hover:text-amber-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      {loading && activities.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500">No activities found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.action] || MessageSquare
              const colorClass = activityColors[activity.action] || 'bg-slate-100 text-slate-600'

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
                      <p className="text-slate-700">{activity.description || activity.details}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium">
                            {getInitials(activity.user_name)}
                          </div>
                          {activity.user_name}
                        </span>
                        <span>•</span>
                        <span>{formatDate(activity.created_at)}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(activity.created_at)}</span>
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                      colorClass
                    )}>
                      {(activity.action || activity.type || 'Unknown').replace('_', ' ').toLowerCase()}
                    </span>
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
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
