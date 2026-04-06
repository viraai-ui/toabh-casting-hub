import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Filter, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { CastingModal } from '@/components/CastingModal'
import { CastingDetailModal } from '@/components/CastingDetailModal'
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
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
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
    if (detailModalOpen) {
      openOverlay('casting-detail-modal', () => setDetailModalOpen(false))
    } else {
      closeOverlay('casting-detail-modal')
    }
  }, [detailModalOpen, openOverlay, closeOverlay])

  useEffect(() => {
    if (editModalOpen) {
      openOverlay('casting-calendar-edit-modal', () => setEditModalOpen(false))
    } else {
      closeOverlay('casting-calendar-edit-modal')
    }
  }, [editModalOpen, openOverlay, closeOverlay])

  const openDetail = (c: Casting) => {
    setSelectedCasting(c)
    setDetailModalOpen(true)
  }

  const openEdit = () => {
    setDetailModalOpen(false)
    setEditModalOpen(true)
  }

  const closeEdit = () => {
    setEditModalOpen(false)
    setSelectedCasting(null)
  }

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
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[600px] w-full flex-col lg:h-[calc(100dvh-6rem)]">
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
      <div className="mb-2 shrink-0">
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
      <div className="min-h-0 flex-1 w-full">
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            getCastingsForDate={getCastingsForDate}
            getCastingColor={getCastingColor}
            onCastingClick={openDetail}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            getCastingsForDate={getCastingsForDate}
            getCastingColor={getCastingColor}
            onCastingClick={openDetail}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            castings={filteredCastings}
            onCastingClick={openDetail}
          />
        )}
      </div>

      <CastingDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedCasting(null)
        }}
        onEdit={openEdit}
        casting={selectedCasting}
      />

      <CastingModal
        open={editModalOpen}
        onClose={closeEdit}
        casting={selectedCasting}
        onSave={() => {
          fetchData()
          closeEdit()
        }}
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="grid grid-cols-7 shrink-0 border-b border-slate-100 bg-slate-50/60">
        {dayLabels.map((label, i) => (
          <div
            key={label}
            className="py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:py-2.5 sm:text-xs"
          >
            <span className="sm:hidden">{dayLabelsShort[i]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {weeks.flat().map((day) => {
          const dayCastings = getCastingsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isToday = isSameDay(day, new Date())
          const visibleCastings = dayCastings.slice(0, 3)
          const overflow = dayCastings.length - visibleCastings.length

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex min-w-0 min-h-0 flex-col overflow-hidden border-b border-r border-slate-100 p-1 sm:p-1.5',
                !isCurrentMonth && 'bg-slate-50/60'
              )}
            >
              <div
                className={cn(
                  'mb-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium leading-none sm:h-6 sm:w-6 sm:text-sm',
                  isToday
                    ? 'bg-amber-500 text-white'
                    : isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-300'
                )}
              >
                {format(day, 'd')}
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {visibleCastings.map((casting) => (
                  <button
                    key={casting.id}
                    onClick={() => onCastingClick(casting)}
                    className="w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-medium leading-tight transition-opacity hover:opacity-75 sm:text-[11px]"
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
                  <span className="truncate pl-1 text-[9px] leading-tight text-slate-400 sm:text-[10px]">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="grid grid-cols-[42px_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-slate-50/50 sm:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div className="p-2" />
        {days.map((day) => (
          <div key={day.toISOString()} className="min-w-0 border-l border-slate-100 p-2 text-center">
            <p className="text-[9px] font-medium uppercase text-slate-400 sm:text-xs">
              {format(day, 'EEE')}
            </p>
            <p className={cn(
              'mt-0.5 text-sm font-bold leading-none sm:text-lg',
              isSameDay(day, new Date()) && 'text-amber-500'
            )}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-[42px_repeat(7,minmax(0,1fr))] border-b border-slate-50 sm:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div className="self-center p-1.5 pr-2 text-right text-[10px] leading-none text-slate-400 sm:text-[11px]">
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
                  className="min-w-0 min-h-[52px] border-l border-slate-50 p-1 sm:min-h-[60px]"
                >
                  {hourCasting && (
                    <button
                      onClick={() => onCastingClick(hourCasting)}
                      className="w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-medium sm:px-1.5 sm:text-[11px]"
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
    <div className="h-full min-h-0 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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
