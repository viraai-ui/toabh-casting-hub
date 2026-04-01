import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Filter, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { CastingModal } from '@/components/CastingModal'
import { useOverlay } from '@/hooks/useOverlayManager'
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
  const { openOverlay, closeOverlay } = useOverlay()
  const [castings, setCastings] = useState<Casting[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [selectedCasting, setSelectedCasting] = useState<Casting | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState<{ team?: string; status?: string; client?: string }>({})
  const [filtersOpen, setFiltersOpen] = useState(false) // collapsed on mobile by default

  const fetchData = async () => {
    try {
      const [castingsData, pipelineData] = await Promise.all([
        api.get('/castings'),
        api.get('/settings/pipeline'),
      ])
      setCastings(Array.isArray(castingsData) ? castingsData : [])
      setPipeline(Array.isArray(pipelineData) ? pipelineData : [])
    } catch (err) {
      console.error('Failed to fetch:', err)
      setCastings([])
      setPipeline([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (modalOpen) {
      openOverlay('casting-calendar-modal', () => setModalOpen(false))
    } else {
      closeOverlay('casting-calendar-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

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

  // Count active filters for badge
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header: month nav + today + view tabs ────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3">
        {/* Left: month nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold min-w-[140px] sm:min-w-[180px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>
          <button
            onClick={goToToday}
            className="ml-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 active:bg-amber-200 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Right: view toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 self-start sm:self-auto">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium capitalize transition-all duration-150',
                view === v
                  ? 'bg-white shadow-sm text-amber-600'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters: collapsible on mobile ───────────────────────────── */}
      <div className="mb-3">
        {/* Filter toggle row */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors mb-2"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 flex items-center justify-center bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
              {activeFilterCount}
            </span>
          )}
          <span className="text-slate-400 text-xs">{filtersOpen ? '▲' : '▼'}</span>
        </button>

        {/* Filter controls — shown when open, always visible on sm+ */}
        <div className={cn(
          'overflow-hidden transition-all duration-200',
          filtersOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 sm:max-h-20 sm:opacity-100'
        )}>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
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
              placeholder="Client..."
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 w-28 sm:w-36"
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({})}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Calendar views ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
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
      </div>

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

// ─────────────────────────────────────────────────────────────────────────────
// MonthView — fully responsive, no horizontal scroll, fits viewport
// ─────────────────────────────────────────────────────────────────────────────
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

  // Split into 6 weeks (6 rows of 7 days)
  const weeks = Array.from({ length: 6 }, (_, wi) => days.slice(wi * 7, wi * 7 + 7))

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayLabelsShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 shrink-0 border-b border-slate-100 bg-slate-50/50">
        {dayLabels.map((label, i) => (
          <div
            key={label}
            className="py-1.5 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {/* Short label on mobile, full on sm+ */}
            <span className="sm:hidden">{dayLabelsShort[i]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid — fills remaining height, 6 equal rows */}
      <div className="flex flex-col flex-1 min-h-0">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 flex-1 min-h-0 border-b border-slate-100 last:border-b-0">
            {week.map((day) => {
              const dayCastings = getCastingsForDate(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isToday = isSameDay(day, new Date())
              const visibleCastings = dayCastings.slice(0, 2) // max 2 on mobile
              const overflow = dayCastings.length - 2

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex flex-col min-h-0 p-1 sm:p-1.5 border-r border-slate-100 last:border-r-0 overflow-hidden',
                    !isCurrentMonth && 'bg-slate-50/60'
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    'shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center mb-0.5 text-[11px] sm:text-sm font-medium leading-none',
                    isToday
                      ? 'bg-amber-500 text-white'
                      : isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-300'
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Events column */}
                  <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
                    {visibleCastings.map((casting) => (
                      <button
                        key={casting.id}
                        onClick={() => onCastingClick(casting)}
                        className="w-full text-left rounded px-1 py-0.5 text-[10px] sm:text-xs font-medium truncate leading-tight hover:opacity-75 transition-opacity"
                        style={{
                          backgroundColor: `${getCastingColor(casting.status)}18`,
                          color: getCastingColor(casting.status),
                        }}
                        title={casting.project_name || casting.client_name}
                      >
                        {casting.project_name || casting.client_name}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[10px] text-slate-400 pl-1 leading-tight">
                        +{overflow}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WeekView — horizontal scroll on mobile (time grid can't reflow), clean on desktop
// ─────────────────────────────────────────────────────────────────────────────
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
  const hours = Array.from({ length: 17 }, (_, i) => i + 6)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/50">
        <div className="p-2" />
        {days.map((day) => (
          <div key={day.toISOString()} className="p-2 text-center border-l border-slate-100">
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-medium">
              {format(day, 'EEE')}
            </p>
            <p className={cn(
              'text-base sm:text-lg font-bold leading-none mt-0.5',
              isSameDay(day, new Date()) && 'text-amber-500'
            )}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Time grid — horizontal scroll on mobile, natural width on desktop */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-50">
              <div className="p-1.5 pr-2 text-[11px] text-slate-400 text-right leading-none self-center">
                {format(new Date().setHours(hour, 0), 'h a')}
              </div>
              {days.map((day) => {
                const dayCastings = getCastingsForDate(day)
                const hourCasting = dayCastings.find((c) => {
                  if (!c.shoot_date_start) return false
                  return parseISO(c.shoot_date_start).getHours() === hour
                })
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="min-h-[52px] sm:min-h-[60px] p-1 border-l border-slate-50"
                  >
                    {hourCasting && (
                      <button
                        onClick={() => onCastingClick(hourCasting)}
                        className="w-full text-left rounded px-1.5 py-0.5 text-[10px] sm:text-xs font-medium truncate"
                        style={{
                          backgroundColor: `${getCastingColor(hourCasting.status)}18`,
                          color: getCastingColor(hourCasting.status),
                        }}
                        title={hourCasting.project_name || hourCasting.client_name}
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

// ─────────────────────────────────────────────────────────────────────────────
// DayView — clean list, mobile-optimized
// ─────────────────────────────────────────────────────────────────────────────
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 text-sm sm:text-base mb-3">
        {format(currentDate, 'EEE, MMM d')}
      </h3>
      {dayCastings.length === 0 ? (
        <p className="text-slate-400 text-sm py-8 text-center">No castings scheduled</p>
      ) : (
        <div className="space-y-2">
          {dayCastings.map((casting) => (
            <button
              key={casting.id}
              onClick={() => onCastingClick(casting)}
              className="w-full flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-slate-200 active:scale-[0.99] transition-all text-left"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {getInitials(casting.client_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">
                  {casting.project_name || 'Untitled'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{casting.client_name}</p>
                {casting.location && (
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{casting.location}</p>
                )}
              </div>
              <span className={cn(
                'shrink-0 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold mt-0.5',
                casting.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                casting.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {casting.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
