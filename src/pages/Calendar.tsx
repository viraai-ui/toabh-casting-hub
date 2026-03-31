import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { CastingModal } from '@/components/CastingModal'
import type { Casting, PipelineStage } from '@/types'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  addDays,
  parseISO,
} from 'date-fns'

export function Calendar() {
  const [castings, setCastings] = useState<Casting[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [selectedCasting, setSelectedCasting] = useState<Casting | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState<{ team?: string; status?: string; client?: string }>({})

  const fetchData = async () => {
    try {
      const [castingsData, pipelineData] = await Promise.all([
        api.get('/castings'),
        api.get('/settings/pipeline'),
      ])
      setCastings(castingsData)
      setPipeline(pipelineData)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getCastingColor = (status: string) => {
    const stage = pipeline.find((p) => p.name === status)
    return stage?.color || '#f59e0b'
  }

  const filteredCastings = useMemo(() => {
    return castings.filter((c) => {
      if (filters.status && c.status !== filters.status) return false
      if (filters.client && !c.client_name?.toLowerCase().includes(filters.client.toLowerCase())) return false
      return true
    })
  }, [castings, filters])

  const getCastingsForDate = (date: Date) => {
    return filteredCastings.filter((c) => {
      if (!c.shoot_date_start) return false
      return isSameDay(parseISO(c.shoot_date_start), date)
    })
  }

  const goToToday = () => setCurrentDate(new Date())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100"
          >
            Today
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                view === v ? 'bg-white shadow-sm text-amber-600' : 'text-slate-600'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
          className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
        >
          <option value="">All Statuses</option>
          {pipeline.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={filters.client || ''}
          onChange={(e) => setFilters({ ...filters, client: e.target.value || undefined })}
          placeholder="Filter by client..."
          className="px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm"
        />
      </div>

      {/* Calendar Grid */}
      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          getCastingsForDate={getCastingsForDate}
          getCastingColor={getCastingColor}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setModalOpen(true)
          }}
        />
      )}

      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          getCastingsForDate={getCastingsForDate}
          getCastingColor={getCastingColor}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setModalOpen(true)
          }}
        />
      )}

      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          castings={filteredCastings}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setModalOpen(true)
          }}
        />
      )}

      <CastingModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedCasting(null)
        }}
        casting={selectedCasting}
        onSave={fetchData}
      />
    </div>
  )
}

function MonthView({
  currentDate,
  getCastingsForDate,
  getCastingColor,
  onCastingClick,
}: {
  currentDate: Date
  getCastingsForDate: (date: Date) => Casting[]
  getCastingColor: (status: string) => string
  onCastingClick: (c: Casting) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  return (
    <div className="card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayCastings = getCastingsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isToday = isSameDay(day, new Date())

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[100px] p-2 border-b border-r border-slate-100',
                !isCurrentMonth && 'bg-slate-50/50'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-sm mb-1',
                isToday && 'bg-amber-500 text-white font-semibold'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayCastings.slice(0, 3).map((casting) => (
                  <button
                    key={casting.id}
                    onClick={() => onCastingClick(casting)}
                    className={cn(
                      'w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate',
                      'hover:opacity-80 transition-opacity'
                    )}
                    style={{ backgroundColor: `${getCastingColor(casting.status)}20`, color: getCastingColor(casting.status) }}
                  >
                    {casting.project_name || casting.client_name}
                  </button>
                ))}
                {dayCastings.length > 3 && (
                  <p className="text-[10px] text-slate-400 pl-1">+{dayCastings.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  currentDate,
  getCastingsForDate,
  getCastingColor,
  onCastingClick,
}: {
  currentDate: Date
  getCastingsForDate: (date: Date) => Casting[]
  getCastingColor: (status: string) => string
  onCastingClick: (c: Casting) => void
}) {
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 17 }, (_, i) => i + 6) // 6am to 10pm

  return (
    <div className="card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-slate-100">
        <div className="p-2" />
        {days.map((day) => (
          <div key={day.toISOString()} className="p-2 text-center border-l border-slate-100">
            <p className="text-xs text-slate-500 uppercase">{format(day, 'EEE')}</p>
            <p className={cn(
              'text-lg font-semibold',
              isSameDay(day, new Date()) && 'text-amber-600'
            )}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-8">
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="p-2 text-xs text-slate-400 text-right border-b border-slate-50">
                {format(new Date().setHours(hour, 0), 'h a')}
              </div>
              {days.map((day) => {
                const dayCastings = getCastingsForDate(day)
                const hourCasting = dayCastings.find((c) => {
                  if (!c.shoot_date_start) return false
                  const castingHour = parseISO(c.shoot_date_start).getHours()
                  return castingHour === hour
                })
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="min-h-[60px] p-1 border-b border-l border-slate-50"
                  >
                    {hourCasting && (
                      <button
                        onClick={() => onCastingClick(hourCasting)}
                        className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate"
                        style={{
                          backgroundColor: `${getCastingColor(hourCasting.status)}20`,
                          color: getCastingColor(hourCasting.status),
                        }}
                      >
                        {hourCasting.project_name || hourCasting.client_name}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DayView({
  currentDate,
  castings,
  onCastingClick,
}: {
  currentDate: Date
  castings: Casting[]
  onCastingClick: (c: Casting) => void
}) {
  const dayCastings = castings.filter(
    (c) => c.shoot_date_start && isSameDay(parseISO(c.shoot_date_start), currentDate)
  )

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-900 mb-4">
        {format(currentDate, 'EEEE, MMMM d, yyyy')}
      </h3>
      {dayCastings.length === 0 ? (
        <p className="text-slate-400">No castings scheduled</p>
      ) : (
        <div className="space-y-3">
          {dayCastings.map((casting) => (
            <button
              key={casting.id}
              onClick={() => onCastingClick(casting)}
              className="w-full card p-4 text-left hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-medium">
                  {getInitials(casting.client_name)}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">
                    {casting.project_name || 'Untitled'}
                    {casting.shoot_date_start && (
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        {new Date(casting.shoot_date_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-slate-500">{casting.client_name}</p>
                  {casting.location && (
                    <p className="text-xs text-slate-400 mt-1">{casting.location}</p>
                  )}
                </div>
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  casting.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  casting.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {casting.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
