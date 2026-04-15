import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Filter, X, CalendarDays, ListTodo } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { CastingModal } from '@/components/CastingModal'
import { CastingDetailModal } from '@/components/CastingDetailModal'
import { useOverlay } from '@/hooks/useOverlayManager'
import { useDataRefresh } from '@/hooks/useDataRefresh'
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
  const [view, setView] = useState<'month' | 'week' | 'day'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'day'
    return 'month'
  })
  const [selectedCasting, setSelectedCasting] = useState<Casting | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [filters, setFilters] = useState<{ team?: string; status?: string; client?: string }>({})
  const [scheduleFocus, setScheduleFocus] = useState<'all' | 'unscheduled' | 'unassigned' | 'upcoming'>('all')
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
    void fetchData()
  }, [])

  useDataRefresh(() => {
    void fetchData()
  })

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

      if (scheduleFocus === 'unscheduled') {
        return !c.shoot_date_start
      }

      if (scheduleFocus === 'unassigned') {
        const hasOwner = Array.isArray(c.assigned_to) ? c.assigned_to.length > 0 : Boolean(c.assigned_names?.trim())
        return Boolean(c.shoot_date_start) && !hasOwner
      }

      if (scheduleFocus === 'upcoming') {
        if (!c.shoot_date_start) return false
        const date = parseISO(c.shoot_date_start)
        const diff = date.getTime() - new Date().getTime()
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
      }

      return true
    })
  }, [castings, filters, scheduleFocus])

  const getCastingsForDate = (date: Date) => {
    return filteredCastings.filter((c) => {
      if (!c.shoot_date_start) return false
      return isSameDay(parseISO(c.shoot_date_start), date)
    })
  }

  const scheduleSummary = useMemo(() => {
    const scheduled = filteredCastings.filter((casting) => Boolean(casting.shoot_date_start))
    const unscheduled = Math.max(filteredCastings.length - scheduled.length, 0)
    const assigned = scheduled.filter((casting) => Array.isArray(casting.assigned_to) ? casting.assigned_to.length > 0 : Boolean(casting.assigned_names?.trim()))
    const unassigned = Math.max(scheduled.length - assigned.length, 0)
    const todayCount = scheduled.filter((casting) => isSameDay(parseISO(casting.shoot_date_start), new Date())).length
    const nextSevenDays = scheduled.filter((casting) => {
      const date = parseISO(casting.shoot_date_start)
      const diff = date.getTime() - new Date().getTime()
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
    }).length

    return {
      total: filteredCastings.length,
      scheduled: scheduled.length,
      unscheduled,
      assigned: assigned.length,
      unassigned,
      todayCount,
      nextSevenDays,
    }
  }, [filteredCastings])

  const schedulePriority = useMemo(() => {
    if (scheduleSummary.total === 0) {
      return {
        label: 'No schedule load yet',
        note: 'Create or import jobs to build the booking and availability layer.',
        tone: 'border-slate-200 bg-slate-50 text-slate-700',
      }
    }

    if (scheduleSummary.unscheduled > 0) {
      return {
        label: 'Scheduling dates is the biggest gap right now',
        note: `${scheduleSummary.unscheduled} job${scheduleSummary.unscheduled === 1 ? '' : 's'} still have no shoot date, so availability planning is still blocked.`,
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    }

    if (scheduleSummary.unassigned > 0) {
      return {
        label: 'Owner coverage is the main scheduling gap',
        note: `${scheduleSummary.unassigned} scheduled job${scheduleSummary.unassigned === 1 ? '' : 's'} still need team ownership before execution is safe.`,
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
      }
    }

    return {
      label: 'Schedule coverage looks strong',
      note: 'Upcoming jobs appear dated and staffed, so this surface is starting to act like a booking OS.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }, [scheduleSummary])

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
    <div className="flex min-h-[calc(100dvh-7rem)] w-full flex-col gap-4 lg:h-[calc(100dvh-6rem)]">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Calendar
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              Agenda first on mobile, planning depth when you need it.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 1 keeps desktop planning strong, but pushes day and week execution higher for real daily use.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <ListTodo className="h-3.5 w-3.5" />
                Recommended now
              </div>
              <div className="mt-1 font-medium text-slate-800">{view === 'month' ? 'Month planning' : view === 'week' ? 'Week execution' : 'Day agenda'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" />
                Active filters
              </div>
              <div className="mt-1 font-medium text-slate-800">{activeFilterCount === 0 ? 'No filters applied' : `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/70 bg-slate-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Scheduled jobs</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{scheduleSummary.scheduled}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Jobs with a shoot date already locked.</p>
        </div>
        <div className="rounded-3xl border border-amber-200/70 bg-amber-50 p-5 shadow-sm text-amber-700">
          <p className="text-sm font-medium text-amber-700/80">Unscheduled</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{scheduleSummary.unscheduled}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Jobs still missing a date, so booking movement is blocked.</p>
        </div>
        <div className="rounded-3xl border border-blue-200/70 bg-blue-50 p-5 shadow-sm text-blue-700">
          <p className="text-sm font-medium text-blue-700/80">Unassigned schedule</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{scheduleSummary.unassigned}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Scheduled jobs that still need clear ownership.</p>
        </div>
        <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50 p-5 shadow-sm text-emerald-700">
          <p className="text-sm font-medium text-emerald-700/80">Next 7 days</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{scheduleSummary.nextSevenDays}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Upcoming scheduled jobs that need active availability focus.</p>
        </div>
      </section>

      <section className={`rounded-3xl border px-5 py-4 shadow-sm ${schedulePriority.tone}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">Schedule priority</p>
            <p className="mt-1 text-base font-semibold text-slate-950">{schedulePriority.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{schedulePriority.note}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
              {scheduleSummary.todayCount} today
            </div>
            <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
              {scheduleSummary.assigned}/{scheduleSummary.scheduled || 0} staffed
            </div>
          </div>
        </div>
      </section>

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
          {(['day', 'week', 'month'] as const).map((v) => (
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

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: `All schedule (${scheduleSummary.total})` },
          { key: 'unscheduled', label: `Unscheduled (${scheduleSummary.unscheduled})` },
          { key: 'unassigned', label: `Unassigned (${scheduleSummary.unassigned})` },
          { key: 'upcoming', label: `Next 7 days (${scheduleSummary.nextSevenDays})` },
        ].map((option) => {
          const active = scheduleFocus === option.key
          return (
            <button
              key={option.key}
              onClick={() => setScheduleFocus(option.key as 'all' | 'unscheduled' | 'unassigned' | 'upcoming')}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {option.label}
            </button>
          )
        })}
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
          filtersOpen ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0 sm:max-h-28 sm:opacity-100'
        )}>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="">All stages</option>
              {pipeline.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={filters.client || ''}
              onChange={(e) => setFilters({ ...filters, client: e.target.value || undefined })}
              placeholder="Client name..."
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

      {scheduleFocus !== 'all' && (
        <p className="text-xs text-slate-500">
          Showing {filteredCastings.length} of {castings.length} job{castings.length === 1 ? '' : 's'} for the current scheduling focus.
        </p>
      )}

      {scheduleFocus !== 'all' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Focus queue</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {scheduleFocus === 'unscheduled'
                  ? 'Jobs waiting for dates'
                  : scheduleFocus === 'unassigned'
                    ? 'Scheduled jobs waiting for ownership'
                    : 'Upcoming jobs needing close tracking'}
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {filteredCastings.length} item{filteredCastings.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCastings.slice(0, 6).map((casting) => {
              const hasOwner = Array.isArray(casting.assigned_to) ? casting.assigned_to.length > 0 : Boolean(casting.assigned_names?.trim())
              const ownerLabel = Array.isArray(casting.assigned_to) && casting.assigned_to.length > 0
                ? casting.assigned_to.map((member) => member.name).join(', ')
                : casting.assigned_names?.trim() || 'No owner yet'

              return (
                <button
                  key={casting.id}
                  onClick={() => openDetail(casting)}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{casting.project_name || 'Untitled job'}</p>
                      <p className="mt-1 text-xs text-slate-500">{casting.client_name || 'No client'}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: `${getCastingColor(casting.status)}18`,
                        color: getCastingColor(casting.status),
                      }}
                    >
                      {casting.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <p>{casting.shoot_date_start ? `Date: ${format(parseISO(casting.shoot_date_start), 'EEE, MMM d')}` : 'Date: Not scheduled yet'}</p>
                    <p>{hasOwner ? `Owner: ${ownerLabel}` : 'Owner: Not assigned yet'}</p>
                    {casting.location && <p className="line-clamp-1">Location: {casting.location}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

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
                {visibleCastings.map((casting) => {
                  const hasOwner = Array.isArray(casting.assigned_to)
                    ? casting.assigned_to.length > 0
                    : Boolean(casting.assigned_names?.trim())

                  return (
                    <button
                      key={casting.id}
                      onClick={() => onCastingClick(casting)}
                      className="w-full rounded px-1 py-0.5 text-left text-[9px] font-medium leading-tight transition-opacity hover:opacity-75 sm:text-[11px]"
                      style={{
                        backgroundColor: `${getCastingColor(casting.status)}18`,
                        color: getCastingColor(casting.status),
                      }}
                      title={casting.project_name || casting.client_name}
                    >
                      <p className="truncate">{casting.project_name || casting.client_name}</p>
                      <p className="truncate text-[8px] sm:text-[9px]" style={{ opacity: 0.78 }}>
                        {hasOwner ? 'Owner assigned' : 'Owner needed'}
                      </p>
                    </button>
                  )
                })}
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
                  {hourCasting && (() => {
                    const hasOwner = Array.isArray(hourCasting.assigned_to)
                      ? hourCasting.assigned_to.length > 0
                      : Boolean(hourCasting.assigned_names?.trim())

                    return (
                      <button
                        onClick={() => onCastingClick(hourCasting)}
                        className="w-full rounded px-1 py-1 text-left text-[9px] font-medium sm:px-1.5 sm:text-[11px]"
                        style={{
                          backgroundColor: `${getCastingColor(hourCasting.status)}18`,
                          color: getCastingColor(hourCasting.status),
                        }}
                        title={hourCasting.project_name || hourCasting.client_name}
                      >
                        <p className="truncate">{hourCasting.project_name || hourCasting.client_name}</p>
                        <p className="mt-0.5 truncate text-[8px] sm:text-[10px]" style={{ opacity: 0.8 }}>
                          {hasOwner ? 'Owner assigned' : 'Owner needed'}
                        </p>
                      </button>
                    )
                  })()}
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
        <p className="text-slate-400 text-sm py-8 text-center">No jobs scheduled</p>
      ) : (
        <div className="space-y-2">
          {dayCastings.map((casting) => {
            const hasOwner = Array.isArray(casting.assigned_to) ? casting.assigned_to.length > 0 : Boolean(casting.assigned_names?.trim())
            const ownerLabel = Array.isArray(casting.assigned_to) && casting.assigned_to.length > 0
              ? casting.assigned_to.map((member) => member.name).join(', ')
              : casting.assigned_names?.trim() || 'No owner assigned'

            return (
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
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                      {casting.shoot_date_start ? format(parseISO(casting.shoot_date_start), 'h:mm a') : 'Time TBD'}
                    </span>
                    <span className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-medium',
                      hasOwner ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {hasOwner ? ownerLabel : 'Owner needed'}
                    </span>
                  </div>
                  {casting.location && (
                    <p className="text-[11px] text-slate-400 mt-2 truncate">{casting.location}</p>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
