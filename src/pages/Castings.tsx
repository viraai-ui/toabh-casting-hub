import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  List,
  Grid3X3,
  Columns3,
  Search,
  Filter,
  Plus,
  Phone,
  MessageCircle,
  Calendar,

  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { useOverlay } from '@/hooks/useOverlayManager'
import { toast } from 'sonner'
import { CastingModal } from '@/components/CastingModal'
import { CastingDetailModal } from '@/components/CastingDetailModal'
import { AdvancedFilters } from '@/components/AdvancedFilters'
import type { Casting, PipelineStage } from '@/types'
import { KanbanBoard } from '@/components/kanban'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

export function Castings() {
  const [searchParams] = useSearchParams()
  const { castingViewMode, setCastingViewMode } = useAppStore()
  const { openOverlay, closeOverlay } = useOverlay()
  const [castings, setCastings] = useState<Casting[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedCasting, setSelectedCasting] = useState<Casting | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<{ [key: string]: string[] }>({})
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc',
  })

  const fetchCastings = useCallback(async () => {
    try {
      const data = await api.get('/castings')
      setCastings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch castings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPipeline = useCallback(async () => {
    try {
      const data = await api.get('/settings/pipeline')
      setPipeline(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch pipeline:', err)
    }
  }, [])

  useEffect(() => {
    fetchCastings()
    fetchPipeline()
  }, [fetchCastings, fetchPipeline])

  // Check for new casting param — open modal when ?new=true is present.
  // Deps: [searchParams] so it re-fires if param changes (e.g. FAB navigation from within Castings).
  // Guard: only fires when modal is closed (avoids re-setting state if modal already open).
  useEffect(() => {
    if (searchParams.get('new') === 'true' && !modalOpen) {
      setSelectedCasting(null)
      setModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, modalOpen])

  // Register CastingModal with overlay manager
  useEffect(() => {
    if (modalOpen) {
      openOverlay('casting-modal', () => setModalOpen(false))
    } else {
      closeOverlay('casting-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

  // Register CastingDetailModal with overlay manager
  useEffect(() => {
    if (detailModalOpen) {
      openOverlay('casting-detail-modal', () => setDetailModalOpen(false))
    } else {
      closeOverlay('casting-detail-modal')
    }
  }, [detailModalOpen, openOverlay, closeOverlay])

  // Register AdvancedFilters panel with overlay manager
  useEffect(() => {
    if (filtersOpen) {
      openOverlay('casting-filters', () => setFiltersOpen(false))
    } else {
      closeOverlay('casting-filters')
    }
  }, [filtersOpen, openOverlay, closeOverlay])

  // Filter and sort castings
  const filteredCastings = castings
    .filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !c.project_name?.toLowerCase().includes(q) &&
          !c.client_name?.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      if (activeFilters.status?.length && !activeFilters.status.includes(c.status)) {
        return false
      }
      if (activeFilters.source?.length && !activeFilters.source.includes(c.source)) {
        return false
      }
      // Team member filter
      if (activeFilters.team_member?.length) {
        const castingIds = (c.assigned_ids || '').toString().split(',').map(s => s.trim())
        const hasMatchingMember = activeFilters.team_member.some(memberId => 
          castingIds.includes(memberId)
        )
        if (!hasMatchingMember) return false
      }
      return true
    })
    .sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Casting] ?? ''
      const bVal = b[sortConfig.key as keyof Casting] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })

  const activeFilterCount = Object.values(activeFilters).flat().length

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search castings..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {[
              { mode: 'list' as const, icon: List },
              { mode: 'grid' as const, icon: Grid3X3 },
              { mode: 'kanban' as const, icon: Columns3 },
            ].map(({ mode, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setCastingViewMode(mode)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  castingViewMode === mode
                    ? 'bg-white shadow-sm text-amber-600'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Filters */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 border rounded-xl transition-colors',
              filtersOpen
                ? 'bg-amber-500/10 border-amber-500 text-amber-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* New Casting */}
          <button
            onClick={() => {
              setSelectedCasting(null)
              setModalOpen(true)
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Casting</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <AdvancedFilters
              pipeline={pipeline}
              filters={activeFilters}
              onFiltersChange={setActiveFilters}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : castingViewMode === 'kanban' ? (
        <KanbanBoard
          castings={filteredCastings}
          pipeline={pipeline}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setDetailModalOpen(true)
          }}
          onCastingsChange={setCastings}
        />
      ) : castingViewMode === 'grid' ? (
        <GridView
          castings={filteredCastings}
          setCastings={setCastings}
          pipeline={pipeline}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setDetailModalOpen(true)
          }}
        />
      ) : (
        <ListView
          castings={filteredCastings}
          pipeline={pipeline}
          setCastings={setCastings}
          sortConfig={sortConfig}
          onSort={handleSort}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setDetailModalOpen(true)
          }}
        />
      )}

      {/* Casting Modal */}
      <CastingModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedCasting(null)
        }}
        casting={selectedCasting}
        onSave={() => {
          fetchCastings()
          fetchPipeline()
        }}
      />

      {/* Casting Detail Modal (read-only) */}
      <CastingDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedCasting(null)
        }}
        onEdit={() => {
          setDetailModalOpen(false)
          setModalOpen(true)
        }}
        casting={selectedCasting}
      />
    </div>
  )
}

function ListView({
  castings,
  pipeline,
  setCastings,
  sortConfig,
  onSort,
  onCastingClick,
}: {
  castings: Casting[]
  pipeline: PipelineStage[]
  setCastings: React.Dispatch<React.SetStateAction<Casting[]>>
  sortConfig: { key: string; direction: 'asc' | 'desc' }
  onSort: (key: string) => void
  onCastingClick: (c: Casting) => void
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [flashingId, setFlashingId] = useState<number | null>(null)
  // Track in-flight request versions to handle rapid changes
  const versionRef = useRef<Map<number, number>>(new Map())

  const handleStatusChange = async (castingId: number, newStatus: string) => {
    const casting = castings.find((c) => c.id === castingId)
    if (!casting || casting.status === newStatus) return

    const currentVersion = (versionRef.current.get(castingId) ?? 0) + 1
    versionRef.current.set(castingId, currentVersion)
    const thisVersion = currentVersion

    const oldStatus = casting.status

    // Optimistic update
    setCastings((prev) =>
      prev.map((c) => (c.id === castingId ? { ...c, status: newStatus } : c))
    )
    setUpdatingId(castingId)
    setFlashingId(castingId)
    setTimeout(() => {
      if (flashingId === castingId) setFlashingId(null)
    }, 1000)

    try {
      await api.put(`/castings/${castingId}/status`, { status: newStatus })
      // Only clear updating if no newer request has superseded this one
      if (versionRef.current.get(castingId) === thisVersion) {
        setUpdatingId(null)
      }
    } catch {
      // Rollback only if this is still the latest request for this row
      if (versionRef.current.get(castingId) === thisVersion) {
        setCastings((prev) =>
          prev.map((c) => (c.id === castingId ? { ...c, status: oldStatus } : c))
        )
        setUpdatingId(null)
        toast.error('Failed to update status')
      }
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {[
                { key: 'client_name', label: 'Client' },
                { key: 'project_name', label: 'Project' },
                { key: 'status', label: 'Status' },
                { key: 'shoot_date_start', label: 'Date' },
                { key: 'budget_max', label: 'Budget' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => onSort(key)}
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-50"
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {sortConfig.key === key &&
                      (sortConfig.direction === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      ))}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {castings.map((casting) => {
              const currentStage = pipeline.find((s) => s.name === casting.status)
              const stageColor = currentStage?.color || '#64748b'
              const isUpdating = updatingId === casting.id
              const isFlashing = flashingId === casting.id

              return (
                <tr
                  key={casting.id}
                  className={cn(
                    'border-b border-slate-50 transition-all',
                    isFlashing
                      ? 'bg-green-50 ring-1 ring-green-200'
                      : 'hover:bg-slate-50 cursor-pointer',
                    isUpdating && 'opacity-60 pointer-events-none'
                  )}
                >
                  {/* Clickable cells — status cell stops propagation */}
                  <td
                    className="px-4 py-3"
                    onClick={() => !isUpdating && onCastingClick(casting)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-medium">
                        {getInitials(casting.client_name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{casting.client_name}</p>
                        <p className="text-xs text-slate-500">{casting.client_company}</p>
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={() => !isUpdating && onCastingClick(casting)}
                  >
                    <p className="font-medium text-slate-900">{casting.project_name || '-'}</p>
                    <p className="text-xs text-slate-500">{casting.location || '-'}</p>
                  </td>

                  {/* Status cell — MUI Select, no row click */}
                  <td
                    className="px-4 py-3 min-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FormControl size="small" fullWidth error={!currentStage}>
                      <Select
                        value={casting.status || ''}
                        onChange={(e) =>
                          handleStatusChange(casting.id, String(e.target.value))
                        }
                        disabled={isUpdating}
                        displayEmpty
                        IconComponent={
                          isUpdating
                            ? () => (
                                <CircularProgress
                                  size={14}
                                  sx={{ mx: 1, color: 'text.secondary' }}
                                />
                              )
                            : undefined
                        }
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: '9999px',
                          border: '1px solid',
                          borderColor: 'divider',
                          '& .MuiSelect-select': {
                            py: '4px',
                            pl: '10px',
                            pr: '32px',
                            color: stageColor,
                            backgroundColor: `${stageColor}14`,
                            borderRadius: '9999px',
                            '&:focus': {
                              borderRadius: '9999px',
                              backgroundColor: `${stageColor}22`,
                            },
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none',
                          },
                          '& .MuiSelect-icon': {
                            color: stageColor,
                            right: 8,
                          },
                          '&:hover .MuiSelect-select': {
                            backgroundColor: `${stageColor}22`,
                          },
                          transition: 'all 0.15s ease',
                          cursor: isUpdating ? 'wait' : 'pointer',
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              borderRadius: '12px',
                              mt: '4px',
                              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                              maxHeight: 280,
                            },
                          },
                          MenuListProps: {
                            sx: { py: '4px' },
                          },
                        }}
                      >
                        {pipeline.map((stage) => (
                          <MenuItem
                            key={stage.id}
                            value={stage.name}
                            sx={{
                              fontSize: '0.8rem',
                              fontWeight: casting.status === stage.name ? 600 : 400,
                              color: stage.color,
                              gap: 1,
                              mx: '8px',
                              my: '2px',
                              borderRadius: '8px',
                              '&::before': {
                                content: '""',
                                display: 'block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: stage.color,
                              },
                              '&:hover': {
                                backgroundColor: `${stage.color}18`,
                              },
                              '&.Mui-selected': {
                                backgroundColor: `${stage.color}14`,
                                fontWeight: 600,
                                '&:hover': {
                                  backgroundColor: `${stage.color}22`,
                                },
                              },
                            }}
                          >
                            {stage.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </td>

                  <td
                    className="px-4 py-3 text-sm text-slate-600"
                    onClick={() => !isUpdating && onCastingClick(casting)}
                  >
                    {formatDate(casting.shoot_date_start) || '-'}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={() => !isUpdating && onCastingClick(casting)}
                  >
                    {casting.budget_min || casting.budget_max ? (
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(casting.budget_min)}
                        {casting.budget_min && casting.budget_max && ' - '}
                        {formatCurrency(casting.budget_max)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {casting.client_contact && (
                        <>
                          <a
                            href={`tel:+91${casting.client_contact}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`https://wa.me/91${casting.client_contact}?text=Regarding ${casting.project_name || 'your casting'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-green-600"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GridView({
  castings,
  setCastings,
  pipeline,
  onCastingClick,
}: {
  castings: Casting[]
  setCastings: React.Dispatch<React.SetStateAction<Casting[]>>
  pipeline: PipelineStage[]
  onCastingClick: (c: Casting) => void
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [flashingId, setFlashingId] = useState<number | null>(null)

  const handleStatusChange = async (castingId: number, newStatus: string) => {
    const casting = castings.find(c => c.id === castingId)
    if (!casting) return
    const oldStatus = casting.status

    setCastings(prev => prev.map(c =>
      c.id === castingId ? { ...c, status: newStatus } : c
    ))
    setUpdatingId(castingId)
    setFlashingId(castingId)
    setTimeout(() => setFlashingId(null), 1000)

    try {
      await api.put(`/castings/${castingId}/status`, { status: newStatus })
    } catch {
      setCastings(prev => prev.map(c =>
        c.id === castingId ? { ...c, status: oldStatus } : c
      ))
      toast.error('Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
      {castings.map((c) => {
        const currentStage = pipeline.find((s) => s.name === c.status)
        const stageColor = currentStage?.color || '#64748b'
        const isFlashing = flashingId === c.id
        const isUpdating = updatingId === c.id

        return (
          <div
            key={c.id}
            className={cn(
              'flex flex-col rounded-2xl bg-white border transition-all duration-200 cursor-pointer',
              'hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300',
              isFlashing
                ? 'border-green-400 shadow-green-100 shadow-md'
                : 'border-slate-200 shadow-sm',
            )}
            style={{ minHeight: 0 }}
            onClick={() => onCastingClick(c)}
          >
            {/* ── ZONE 1: Title + Actions ─────────────────────────────── */}
            <div className="flex items-start justify-between gap-2 p-5 pb-3">
              {/* Project title — bold, truncate overflow */}
              <h3
                className="flex-1 font-bold text-[15px] text-slate-900 leading-snug line-clamp-2 min-w-0"
                title={c.project_name || 'Untitled'}
              >
                {c.project_name || 'Untitled'}
              </h3>

              {/* Action icons — top-right, consistent 32px tap targets */}
              <div className="flex items-center gap-1 shrink-0">
                {c.client_contact && (
                  <>
                    <a
                      href={'tel:' + c.client_contact}
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={'https://wa.me/' + c.client_contact.replace(/\D/g, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* ── ZONE 2: Info stack — uniform vertical rhythm ───────── */}
            <div className="flex-1 px-5 space-y-1 min-w-0">
              {/* Client name */}
              <p
                className="text-[13px] font-medium text-slate-700 truncate"
                title={c.client_name}
              >
                {c.client_name || '-'}
              </p>

              {/* Phone */}
              {c.client_contact && (
                <p className="text-[12px] text-slate-500 truncate flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                  <span className="truncate">{c.client_contact}</span>
                </p>
              )}

              {/* Shoot dates */}
              {c.shoot_date_start && (
                <p className="text-[12px] text-slate-400 truncate flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 shrink-0 text-slate-300" />
                  <span className="truncate">
                    {formatDate(c.shoot_date_start)}
                    {c.shoot_date_end && c.shoot_date_end !== c.shoot_date_start
                      ? ` – ${formatDate(c.shoot_date_end)}`
                      : ''}
                  </span>
                </p>
              )}
            </div>

            {/* ── ZONE 3: Footer row ──────────────────────────────────── */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-3 mt-2 border-t border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MUI Status Select — pill, color-coded */}
              <FormControl size="small" sx={{ flexShrink: 0 }}>
                <Select
                  value={c.status || ''}
                  onChange={(e) => handleStatusChange(c.id, String(e.target.value))}
                  disabled={isUpdating}
                  displayEmpty
                  IconComponent={
                    isUpdating
                      ? () => (
                          <CircularProgress
                            size={12}
                            sx={{ mx: 0.75, color: 'text.secondary', flexShrink: 0 }}
                          />
                        )
                      : undefined
                  }
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: `${stageColor}40`,
                    minWidth: 100,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    '& .MuiSelect-select': {
                      py: '4px',
                      pl: '10px',
                      pr: '28px',
                      color: stageColor,
                      backgroundColor: `${stageColor}12`,
                      borderRadius: '9999px',
                      '&:focus': {
                        borderRadius: '9999px',
                        backgroundColor: `${stageColor}1a`,
                      },
                    },
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '& .MuiSelect-icon': { color: stageColor, right: 6 },
                    '&:hover .MuiSelect-select': {
                      backgroundColor: `${stageColor}1a`,
                    },
                    transition: 'all 0.15s ease',
                    cursor: isUpdating ? 'wait' : 'pointer',
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        borderRadius: '12px',
                        mt: '4px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        maxHeight: 280,
                      },
                    },
                    MenuListProps: { sx: { py: '4px' } },
                  }}
                >
                  {pipeline.map((stage) => (
                    <MenuItem
                      key={stage.id}
                      value={stage.name}
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: c.status === stage.name ? 700 : 400,
                        color: stage.color,
                        gap: 1,
                        mx: '6px',
                        my: '2px',
                        borderRadius: '8px',
                        '&::before': {
                          content: '""',
                          display: 'block',
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: stage.color,
                          flexShrink: 0,
                        },
                        '&:hover': { backgroundColor: `${stage.color}12` },
                        '&.Mui-selected': {
                          backgroundColor: `${stage.color}14`,
                          fontWeight: 700,
                          '&:hover': { backgroundColor: `${stage.color}1a` },
                        },
                      }}
                    >
                      {stage.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Assigned team member — right-aligned, truncate */}
              {c.assigned_names ? (
                <span
                  className="text-[11px] text-slate-400 truncate text-right flex-1 min-w-0 ml-1"
                  title={c.assigned_names}
                >
                  {c.assigned_names.split(',')[0].trim()}
                </span>
              ) : (
                <span className="text-[11px] text-slate-300 truncate text-right flex-1 min-w-0 ml-1">
                  Unassigned
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

