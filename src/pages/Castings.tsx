import { useState, useEffect, useCallback } from 'react'
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
import { CastingModal } from '@/components/CastingModal'
import { CastingDetailModal } from '@/components/CastingDetailModal'
import { AdvancedFilters } from '@/components/AdvancedFilters'
import type { Casting, PipelineStage } from '@/types'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const statusColors: { [key: string]: string } = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  REVIEW: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export function Castings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { castingViewMode, setCastingViewMode } = useAppStore()
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
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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

  // Check for new casting param
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setSelectedCasting(null)
      setModalOpen(true)
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const castingId = Number(active.id)
    const newStatus = over.id as string

    const casting = castings.find((c) => c.id === castingId)
    if (casting && casting.status !== newStatus) {
      try {
        await api.put(`/castings/${castingId}`, { status: newStatus })
        setCastings((prev) =>
          prev.map((c) => (c.id === castingId ? { ...c, status: newStatus } : c))
        )
      } catch (err) {
        console.error('Failed to update status:', err)
      }
    }
    setActiveId(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
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
        <KanbanView
          castings={filteredCastings}
          pipeline={pipeline}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setDetailModalOpen(true)
          }}
          sensors={sensors}
          handleDragEnd={handleDragEnd}
          handleDragStart={handleDragStart}
          activeId={activeId}
        />
      ) : castingViewMode === 'grid' ? (
        <GridView
          castings={filteredCastings}
          pipeline={pipeline}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setDetailModalOpen(true)
          }}
        />
      ) : (
        <ListView
          castings={filteredCastings}
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
  sortConfig,
  onSort,
  onCastingClick,
}: {
  castings: Casting[]
  sortConfig: { key: string; direction: 'asc' | 'desc' }
  onSort: (key: string) => void
  onCastingClick: (c: Casting) => void
}) {
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
                    {sortConfig.key === key && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {castings.map((casting) => (
              <tr
                key={casting.id}
                onClick={() => onCastingClick(casting)}
                className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{casting.project_name || '-'}</p>
                  <p className="text-xs text-slate-500">{casting.location || '-'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    statusColors[casting.status] || 'bg-slate-100 text-slate-600'
                  )}>
                    {casting.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDate(casting.shoot_date_start) || '-'}
                </td>
                <td className="px-4 py-3">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GridView({
  castings,
  pipeline,
  onCastingClick,
}: {
  castings: Casting[]
  pipeline: PipelineStage[]
  onCastingClick: (c: Casting) => void
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [flashingId, setFlashingId] = useState<number | null>(null)

  const handlePipelineStageChange = async (castingId: number, newStageName: string) => {
    setUpdatingId(castingId)
    try {
      await api.put(`/castings/${castingId}/status`, { status: newStageName })
      setFlashingId(castingId)
      setTimeout(() => setFlashingId(null), 1000)
    } catch (err) {
      console.error('Failed to update pipeline stage:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
      {castings.map((c) => {
        const currentStage = pipeline.find((s) => s.name === c.status)
        const stageColor = currentStage?.color || '#64748b'

        return (
          <div
            key={c.id}
            className={cn(
              'flex flex-col h-full rounded-xl border p-4 transition-all cursor-pointer',
              flashingId === c.id
                ? 'border-green-400 ring-2 ring-green-100'
                : 'border-gray-200 hover:border-gray-300'
            )}
            onClick={() => onCastingClick(c)}
          >
            {/* Top bar: action buttons only — compact, top-right */}
            <div className="flex items-center justify-end gap-1 mb-3">
              {c.client_contact && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open('tel:' + c.client_contact)
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open('https://wa.me/' + c.client_contact.replace(/\D/g, ''))
                    }}
                    className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="font-bold text-base text-slate-900 mb-1 line-clamp-2 leading-snug">
                {c.project_name || 'Untitled'}
              </h3>
              <p className="text-[13px] text-slate-600 truncate">{c.client_name}</p>
              {c.client_contact && (
                <p className="text-[13px] text-slate-500 truncate">{c.client_contact}</p>
              )}
              {c.client_email && (
                <p className="text-[13px] text-slate-400 truncate">{c.client_email}</p>
              )}
              {c.shoot_date_start && (
                <p className="text-[13px] text-slate-500 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 shrink-0" />
                  {formatDate(c.shoot_date_start)}
                  {c.shoot_date_end && c.shoot_date_end !== c.shoot_date_start
                    ? ` – ${formatDate(c.shoot_date_end)}`
                    : ''}
                </p>
              )}
            </div>

            {/* Footer: status dropdown (compact) + assigned name */}
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
              {/* Status dropdown — compact, bottom-left */}
              <select
                value={c.status || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  handlePipelineStageChange(c.id, e.target.value)
                }}
                disabled={updatingId === c.id}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-medium border-0 cursor-pointer bg-transparent focus:outline-none transition-all px-0 py-0 rounded-none"
                style={{ color: stageColor }}
                title="Change status"
              >
                {pipeline.map((stage) => (
                  <option key={stage.id} value={stage.name}>
                    {stage.name}
                  </option>
                ))}
              </select>

              {/* Assigned name — bottom-right */}
              {c.assigned_names && (
                <span className="text-[11px] text-slate-400 truncate ml-auto">
                  {c.assigned_names.split(',')[0]}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SortableCard({
  casting,
  onClick,
}: {
  casting: Casting
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(casting.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'card p-3 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
          {getInitials(casting.client_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">
            {casting.project_name || 'Untitled'}
          </p>
          <p className="text-xs text-slate-500 truncate">{casting.client_name}</p>
        </div>
      </div>
      {casting.shoot_date_start && (
        <p className="text-xs text-slate-400">{formatDate(casting.shoot_date_start)}</p>
      )}
    </div>
  )
}

function KanbanView({
  castings,
  pipeline,
  onCastingClick,
  sensors,
  handleDragEnd,
  handleDragStart,
  activeId,
}: {
  castings: Casting[]
  pipeline: PipelineStage[]
  onCastingClick: (c: Casting) => void
  sensors: any
  handleDragEnd: (e: DragEndEvent) => void
  handleDragStart: (e: DragStartEvent) => void
  activeId: string | null
}) {
  const activeCasting = castings.find((c) => String(c.id) === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipeline.map((stage) => {
          const stageCastings = castings.filter((c) => c.status === stage.name)
          return (
            <div
              key={stage.id}
              id={stage.name}
              className="flex-shrink-0 w-72"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="font-semibold text-slate-900">{stage.name}</h3>
                <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {stageCastings.length}
                </span>
              </div>
              <SortableContext
                items={stageCastings.map((c) => String(c.id))}
                strategy={horizontalListSortingStrategy}
                id={stage.name}
              >
                <div className="space-y-2 min-h-[200px] p-2 bg-slate-50/50 rounded-xl">
                  {stageCastings.map((casting) => (
                    <SortableCard
                      key={casting.id}
                      casting={casting}
                      onClick={() => onCastingClick(casting)}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeCasting && (
          <div className="card p-3 shadow-xl opacity-90">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium">
                {getInitials(activeCasting.client_name)}
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">
                  {activeCasting.project_name || 'Untitled'}
                </p>
                <p className="text-xs text-slate-500">{activeCasting.client_name}</p>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
