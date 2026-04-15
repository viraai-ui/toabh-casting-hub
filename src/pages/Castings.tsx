import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type SetStateAction,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  Settings2,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { useOverlay } from '@/hooks/useOverlayManager'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { toast } from 'sonner'
import { CastingModal } from '@/components/CastingModal'
import { CastingDetailModal } from '@/components/CastingDetailModal'
import { AdvancedFilters } from '@/components/AdvancedFilters'
import {
  countActiveCastingFilters,
  matchesCastingFilters,
  normalizeCastingFilters,
  type CastingFilters,
} from '@/features/castings/filterPresets'
import type { Casting, PipelineStage } from '@/types'
import { KanbanBoard } from '@/components/kanban'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

// Statuses hidden from Grid/List views but still shown in Kanban
const HIDDEN_STATUSES = ['WON', 'LOST'] as const

const LIST_VIEW_COLUMN_CONFIG_KEY = 'castings-list-columns'

interface StoredListViewPreferences {
  order: string[]
  visibility: Record<string, boolean>
}

interface ListViewColumn {
  key: string
  label: string
  sortKey: string
  defaultVisible: boolean
  mobileHidden?: boolean
  desktopHidden?: boolean
}

const LIST_VIEW_COLUMNS: ListViewColumn[] = [
  { key: 'client', label: 'Client', sortKey: 'client_name', defaultVisible: true },
  { key: 'project', label: 'Project', sortKey: 'project_name', defaultVisible: true },
  { key: 'status', label: 'Status', sortKey: 'status', defaultVisible: true },
  { key: 'shootDate', label: 'Date', sortKey: 'shoot_date_start', defaultVisible: true },
  { key: 'budget', label: 'Budget', sortKey: 'budget_max', defaultVisible: true },
  { key: 'source', label: 'Lead Source', sortKey: 'source_detail', defaultVisible: true },
  { key: 'team', label: 'Team Members', sortKey: 'assigned_names', defaultVisible: true, mobileHidden: true },
  { key: 'attachments', label: 'Attachments', sortKey: 'attachments_count', defaultVisible: true, mobileHidden: true },
  { key: 'location', label: 'Location', sortKey: 'location', defaultVisible: true, mobileHidden: true },
]

function getDefaultColumnVisibility() {
  return LIST_VIEW_COLUMNS.reduce((acc, column) => {
    acc[column.key] = column.defaultVisible
    return acc
  }, {} as Record<string, boolean>)
}

function getDefaultColumnOrder() {
  return LIST_VIEW_COLUMNS.map((column) => column.key)
}

function normalizeColumnOrder(order?: unknown) {
  const defaults = getDefaultColumnOrder()
  const incoming = Array.isArray(order) ? order.filter((key): key is string => typeof key === 'string') : []
  const known = incoming.filter((key) => defaults.includes(key))
  const missing = defaults.filter((key) => !known.includes(key))
  return [...known, ...missing]
}

function getStoredListViewPreferences(): StoredListViewPreferences {
  const defaults = {
    order: getDefaultColumnOrder(),
    visibility: getDefaultColumnVisibility(),
  }

  if (typeof window === 'undefined') return defaults

  const saved = localStorage.getItem(LIST_VIEW_COLUMN_CONFIG_KEY)
  if (!saved) return defaults

  try {
    const parsed = JSON.parse(saved) as Partial<StoredListViewPreferences> | Record<string, boolean>

    if (parsed && 'visibility' in parsed) {
      return {
        order: normalizeColumnOrder(parsed.order),
        visibility: {
          ...defaults.visibility,
          ...Object.fromEntries(
            Object.entries(parsed.visibility || {}).filter(
              ([key, value]) => typeof defaults.visibility[key] === 'boolean' && typeof value === 'boolean',
            ),
          ),
        },
      }
    }

    return {
      order: defaults.order,
      visibility: {
        ...defaults.visibility,
        ...Object.fromEntries(
          Object.entries(parsed || {}).filter(
            ([key, value]) => typeof defaults.visibility[key] === 'boolean' && typeof value === 'boolean',
          ),
        ),
      },
    }
  } catch {
    return defaults
  }
}

function parseAssignedNames(value?: string | null) {
  if (!value) return [] as string[]
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

function formatSourceLabel(casting: Casting) {
  if (casting.source && casting.source.trim()) {
    const detail = (casting as { source_detail?: string | null }).source_detail
    if (detail?.trim()) {
      return `${casting.source.trim()} · ${detail.trim()}`
    }
    return casting.source.trim()
  }

  return '-'
}

function getSubmissionReadiness(casting: Casting) {
  const hasProject = Boolean(casting.project_name?.trim())
  const hasClient = Boolean(casting.client_name?.trim())
  const hasTeam =
    parseAssignedNames(casting.assigned_names).length > 0 ||
    (Array.isArray(casting.assigned_to) && casting.assigned_to.length > 0)
  const hasBrief = Boolean(casting.requirements?.trim())
  const hasTiming = Boolean(casting.shoot_date_start)

  if (hasProject && hasClient && hasTeam && hasBrief && hasTiming) {
    return {
      label: 'Submission ready',
      note: 'Ops can move talent now',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (hasProject && hasClient && (hasTeam || hasBrief)) {
    return {
      label: 'Needs ops fill-in',
      note: 'Almost ready for movement',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    label: 'Intake incomplete',
    note: 'Core job inputs still missing',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

function getNextStepSignal(casting: Casting) {
  const hasProject = Boolean(casting.project_name?.trim())
  const hasClient = Boolean(casting.client_name?.trim())
  const hasTeam =
    parseAssignedNames(casting.assigned_names).length > 0 ||
    (Array.isArray(casting.assigned_to) && casting.assigned_to.length > 0)
  const hasBrief = Boolean(casting.requirements?.trim())
  const normalizedStatus = (casting.status || 'NEW').toUpperCase()

  if (!hasProject || !hasClient) {
    return {
      label: 'Complete intake',
      note: 'Add missing project or client basics',
      className: 'text-amber-700 bg-amber-50 border-amber-200',
    }
  }

  if (!hasTeam) {
    return {
      label: 'Assign owner',
      note: 'Put an internal lead on this job',
      className: 'text-blue-700 bg-blue-50 border-blue-200',
    }
  }

  if (!hasBrief) {
    return {
      label: 'Tighten brief',
      note: 'Add clearer requirements for ops and talent',
      className: 'text-violet-700 bg-violet-50 border-violet-200',
    }
  }

  if (['SHORTLISTED', 'OFFERED', 'REVIEW'].includes(normalizedStatus)) {
    return {
      label: 'Chase decision',
      note: 'Follow up on shortlist, review, or offer movement',
      className: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    }
  }

  return {
    label: 'Move talent',
    note: 'Queue is ready for active ops execution',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  }
}

function getMissingWorkflowItems(casting: Casting) {
  const items = [] as string[]

  if (!casting.project_name?.trim()) items.push('project')
  if (!casting.client_name?.trim()) items.push('client')

  const hasTeam =
    parseAssignedNames(casting.assigned_names).length > 0 ||
    (Array.isArray(casting.assigned_to) && casting.assigned_to.length > 0)
  if (!hasTeam) items.push('owner')

  if (!casting.requirements?.trim()) items.push('brief')
  if (!casting.shoot_date_start) items.push('timing')

  return items
}

export function Castings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { castingViewMode, setCastingViewMode, currentUser } = useAppStore()
  const { openOverlay, closeOverlay } = useOverlay()
  const [castings, setCastings] = useState<Casting[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedCasting, setSelectedCasting] = useState<Casting | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<CastingFilters>({})
  // Track when the casting modal was explicitly closed by the user.
  // Used to prevent the detail-modal → casting-modal reopen flow from overriding
  // a deliberate close (Cancel / Save).
  const modalClosedRef = useRef(false)
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
    void fetchCastings()
    void fetchPipeline()
  }, [fetchCastings, fetchPipeline])

  useDataRefresh(() => {
    void fetchCastings()
    void fetchPipeline()
  })

  // Register CastingModal with overlay manager
  useEffect(() => {
    if (modalOpen) {
      modalClosedRef.current = false
      openOverlay('casting-modal', () => setModalOpen(false))
    } else {
      modalClosedRef.current = true
      closeOverlay('casting-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

  // Handle ?new=true URL param — opens the new-casting modal.
  // Uses modalOpen (not a ref) as the guard so the check is always fresh.
  // modalOpen is intentionally NOT in deps — we WANT the effect to re-check
  // modalOpen's current value every time searchParams change.
  useEffect(() => {
    if (searchParams.get('new') !== 'true') return
    if (modalOpen) return // already open — don't re-enter
    setSelectedCasting(null)
    setModalOpen(true)
    navigate('/castings', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const targetId = Number(searchParams.get('id'))
    if (!targetId || !castings.length) return

    const match = castings.find((casting) => casting.id === targetId)
    if (!match) return

    setSelectedCasting(match)
    setDetailModalOpen(true)
    navigate('/castings', { replace: true })
  }, [castings, navigate, searchParams])

  // Register CastingDetailModal with overlay manager
  useEffect(() => {
    if (detailModalOpen) {
      openOverlay('casting-detail-modal', () => setDetailModalOpen(false))
    } else {
      closeOverlay('casting-detail-modal')
      // Check the ref at the START of the effect body (before cleanup fires again).
      // If the casting modal was explicitly closed while the detail was open,
      // modalClosedRef.current = true → don't let detail-modal reopening re-open it.
      const wasExplicitlyClosed = modalClosedRef.current
      if (!wasExplicitlyClosed) {
        setModalOpen(true)
      }
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

  const appliedFilters = normalizeCastingFilters(activeFilters)

  // Filter and sort castings
  const getSortableValue = (casting: Casting, key: string): number | string => {
    switch (key) {
      case 'shootDate':
      case 'shoot_date_start': {
        const value = casting.shoot_date_start || casting.shoot_date_end || ''
        if (!value) return ''
        return new Date(value).getTime()
      }
      case 'created_at': {
        if (!casting.created_at) return ''
        return new Date(casting.created_at).getTime()
      }
      case 'budget_min':
      case 'budget_max':
      case 'budget':
        return casting.budget_max ?? casting.budget_min ?? 0
      case 'attachments_count': {
        const value = (casting as { attachments_count?: number | null }).attachments_count
        return typeof value === 'number' ? value : 0
      }
      case 'assigned_names':
        return teamNamesForCasting(casting).length
      case 'source_detail':
        return formatSourceLabel(casting)
      case 'project_name':
      case 'client_name':
      case 'location':
      case 'source':
      case 'status':
      case 'contact':
      case 'team':
        return (casting as unknown as { [key: string]: string | undefined })[key] || casting.client_name || ''
      default: {
        const value = (casting as unknown as { [key: string]: unknown })[key]
        return typeof value === 'number' || typeof value === 'string' ? value : String(value ?? '')
      }
    }
  }

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

      return matchesCastingFilters(c, appliedFilters)
    })
    .sort((a, b) => {
      const aVal = getSortableValue(a, sortConfig.key)
      const bVal = getSortableValue(b, sortConfig.key)

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aText = String(aVal)
      const bText = String(bVal)
      const cmp = aText.localeCompare(bText, undefined, { sensitivity: 'base', numeric: true })
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })

  // Grid/List: exclude WON/LOST (still kept in global state for Kanban)
  const gridListCastings = filteredCastings.filter(
    (c) => !HIDDEN_STATUSES.includes(c.status as typeof HIDDEN_STATUSES[number])
  )

  const activeFilterCount = countActiveCastingFilters(appliedFilters)

  const workflowSummary = useMemo(() => {
    const normalized = filteredCastings.map((casting) => ({
      ...casting,
      normalizedStatus: (casting.status || 'NEW').toUpperCase(),
    }))

    const decisionStatuses = new Set(['SHORTLISTED', 'OFFERED', 'REVIEW'])
    const confirmedStatuses = new Set(['COMPLETED', 'CONFIRMED', 'BOOKED', 'WON'])

    const activeQueue = normalized.filter((casting) => !confirmedStatuses.has(casting.normalizedStatus)).length
    const decisionQueue = normalized.filter((casting) => decisionStatuses.has(casting.normalizedStatus)).length
    const assignedJobs = normalized.filter((casting) => parseAssignedNames((casting as { assigned_names?: string | null }).assigned_names).length > 0).length
    const readyForTalent = normalized.filter((casting) => Boolean(casting.project_name) && Boolean(casting.client_name)).length
    const incompleteIntake = normalized.filter((casting) => !casting.project_name || !casting.client_name).length
    const phaseDistribution = {
      intake: normalized.filter((casting) => ['NEW'].includes(casting.normalizedStatus)).length,
      submission: normalized.filter((casting) => ['IN_PROGRESS', 'ACTIVE'].includes(casting.normalizedStatus)).length,
      decision: decisionQueue,
      confirmed: normalized.filter((casting) => ['COMPLETED', 'CONFIRMED', 'BOOKED', 'WON'].includes(casting.normalizedStatus)).length,
    }

    return {
      activeQueue,
      decisionQueue,
      assignedJobs,
      readyForTalent,
      incompleteIntake,
      ownershipCoverage: readyForTalent > 0 ? Math.round((assignedJobs / readyForTalent) * 100) : 0,
      phaseDistribution,
      total: normalized.length,
    }
  }, [filteredCastings])

  const workflowHealth = useMemo(() => {
    if (workflowSummary.total === 0) {
      return {
        label: 'Queue is clear',
        note: 'No jobs are in the current filtered view.',
        tone: 'border-slate-200 bg-slate-50 text-slate-700',
      }
    }

    if (workflowSummary.incompleteIntake > 0) {
      return {
        label: `${workflowSummary.incompleteIntake} job${workflowSummary.incompleteIntake === 1 ? '' : 's'} need intake cleanup`,
        note: 'Project or client inputs are still missing before ops can move cleanly.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    }

    if (workflowSummary.decisionQueue > 0) {
      return {
        label: `${workflowSummary.decisionQueue} job${workflowSummary.decisionQueue === 1 ? '' : 's'} in decision stage`,
        note: 'This queue needs fast follow-through on shortlist, review, or offer movement.',
        tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      }
    }

    return {
      label: 'Workflow health looks strong',
      note: 'Current jobs are structured well enough for active ops movement.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }, [workflowSummary])

  const queueActionPriorities = useMemo(() => {
    const actions: Array<{ label: string; note: string; tone: string }> = []

    if (workflowSummary.incompleteIntake > 0) {
      actions.push({
        label: 'Clean intake first',
        note: `${workflowSummary.incompleteIntake} job${workflowSummary.incompleteIntake === 1 ? '' : 's'} still need core project/client inputs.`,
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      })
    }

    if (workflowSummary.decisionQueue > 0) {
      actions.push({
        label: 'Push decision follow-up',
        note: `${workflowSummary.decisionQueue} job${workflowSummary.decisionQueue === 1 ? '' : 's'} are sitting in shortlist, review, or offer stage.`,
        tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      })
    }

    const unassignedJobs = Math.max(workflowSummary.readyForTalent - workflowSummary.assignedJobs, 0)
    if (unassignedJobs > 0) {
      actions.push({
        label: 'Assign internal ownership',
        note: `${unassignedJobs} ready job${unassignedJobs === 1 ? '' : 's'} can move faster with a named owner.`,
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
      })
    }

    if (actions.length === 0) {
      actions.push({
        label: 'Queue is ready to move',
        note: 'Current filtered jobs look clean enough for active ops execution.',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      })
    }

    return actions.slice(0, 3)
  }, [workflowSummary])

  const queueBottleneck = useMemo(() => {
    const candidates = [
      {
        key: 'intake',
        count: workflowSummary.incompleteIntake,
        label: 'Intake is the current bottleneck',
        note: 'Most friction is still in missing project/client setup.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      },
      {
        key: 'decision',
        count: workflowSummary.decisionQueue,
        label: 'Decision follow-up is the current bottleneck',
        note: 'The queue is clustering around shortlist, review, or offer follow-through.',
        tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      },
      {
        key: 'submission',
        count: workflowSummary.phaseDistribution.submission,
        label: 'Submission movement is the current bottleneck',
        note: 'A large share of work is sitting in active submission stage.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      },
    ].sort((a, b) => b.count - a.count)

    const winner = candidates[0]
    if (!winner || winner.count === 0) {
      return {
        label: 'No obvious bottleneck right now',
        note: 'The filtered queue looks relatively balanced across phases.',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      }
    }

    return {
      label: winner.label,
      note: `${winner.count} job${winner.count === 1 ? '' : 's'} are concentrated here. ${winner.note}`,
      tone: winner.tone,
    }
  }, [workflowSummary])

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Jobs
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              The live work queue, built for fast scanning and action.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 1 makes Jobs cleaner, faster on mobile, and less like a generic CRM list.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                'relative inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
                filtersOpen
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toabh-global-action', { detail: { action: 'open-casting-modal' } }))
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New job
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkflowSummaryCard
          label="Active queue"
          value={workflowSummary.activeQueue}
          note="Jobs still in motion and needing follow-through."
          tone="bg-amber-50 text-amber-700 border-amber-200/70"
        />
        <WorkflowSummaryCard
          label="Decision queue"
          value={workflowSummary.decisionQueue}
          note="Shortlist / review / offer-stage jobs to watch closely."
          tone="bg-cyan-50 text-cyan-700 border-cyan-200/70"
        />
        <WorkflowSummaryCard
          label="Assigned internally"
          value={workflowSummary.assignedJobs}
          note={`Ownership coverage ${workflowSummary.ownershipCoverage}% across jobs ready for movement.`}
          tone="bg-blue-50 text-blue-700 border-blue-200/70"
        />
        <WorkflowSummaryCard
          label="Ready for talent"
          value={workflowSummary.readyForTalent}
          note="Client + project details are strong enough to push outward."
          tone="bg-emerald-50 text-emerald-700 border-emerald-200/70"
        />
      </section>

      <section className={cn('rounded-3xl border px-5 py-4 shadow-sm', workflowHealth.tone)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Intake', value: workflowSummary.phaseDistribution.intake, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Submission', value: workflowSummary.phaseDistribution.submission, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Decision', value: workflowSummary.phaseDistribution.decision, tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
              { label: 'Confirmed', value: workflowSummary.phaseDistribution.confirmed, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            ].map((phase) => (
              <div key={phase.label} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', phase.tone)}>
                <span>{phase.label}</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px]">{phase.value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">Workflow health</p>
              <p className="mt-1 text-base font-semibold text-slate-950">{workflowHealth.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{workflowHealth.note}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
                {workflowSummary.readyForTalent}/{workflowSummary.total} ready for movement
              </div>
              <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
                {workflowSummary.ownershipCoverage}% ownership coverage
              </div>
            </div>
          </div>

          <div className={cn('rounded-2xl border px-3 py-3 shadow-sm', queueBottleneck.tone)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Queue bottleneck</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{queueBottleneck.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{queueBottleneck.note}</p>
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            {queueActionPriorities.map((action) => (
              <div key={action.label} className={cn('rounded-2xl border px-3 py-3 shadow-sm', action.tone)}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Queue action</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{action.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, clients, or project names..."
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

          <div className="hidden sm:block h-10 w-px bg-slate-200" aria-hidden="true" />
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
              currentUserName={currentUser?.name || 'Team Member'}
              filters={appliedFilters}
              onApply={setActiveFilters}
              onReset={() => setActiveFilters({})}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : filteredCastings.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">No jobs found</p>
          <p className="mt-1 text-sm text-slate-500">Try clearing filters, changing search, or creating a new job.</p>
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
          castings={gridListCastings}
          setCastings={setCastings}
          pipeline={pipeline}
          onCastingClick={(c) => {
            setSelectedCasting(c)
            setDetailModalOpen(true)
          }}
        />
      ) : (
        <ListView
          castings={gridListCastings}
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
          // Reset explicit-close flag so the detail-modal effect reopens the casting modal
          modalClosedRef.current = false
          setDetailModalOpen(false)
          setModalOpen(true)
        }}
        casting={selectedCasting}
      />
    </div>
  )
}

function WorkflowSummaryCard({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number
  note: string
  tone: string
}) {
  return (
    <div className={cn('rounded-3xl border p-5 shadow-sm', tone)}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
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
  setCastings: Dispatch<SetStateAction<Casting[]>>
  sortConfig: { key: string; direction: 'asc' | 'desc' }
  onSort: (key: string) => void
  onCastingClick: (c: Casting) => void
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [flashingId, setFlashingId] = useState<number | null>(null)
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<number | null>(null)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => getStoredListViewPreferences().visibility,
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(() => getStoredListViewPreferences().order)
  const [columnSettingsPosition, setColumnSettingsPosition] = useState({ left: 0, top: 0, placement: 'bottom' as 'bottom' | 'top' })
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const settingsMenuRef = useRef<HTMLDivElement | null>(null)

  const persistColumnPreferences = useCallback(
    (nextVisibility: Record<string, boolean>, nextOrder: string[]) => {
      if (typeof window === 'undefined') return
      localStorage.setItem(
        LIST_VIEW_COLUMN_CONFIG_KEY,
        JSON.stringify({
          visibility: nextVisibility,
          order: normalizeColumnOrder(nextOrder),
        }),
      )
    },
    [],
  )

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setShowColumnSettings(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnSettings(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useLayoutEffect(() => {
    if (!showColumnSettings) return

    const updateMenuPosition = () => {
      const buttonRect = settingsButtonRef.current?.getBoundingClientRect()
      const menuRect = settingsMenuRef.current?.getBoundingClientRect()
      if (!buttonRect) return

      const menuWidth = menuRect?.width || 256
      const menuHeight = menuRect?.height || 320
      const viewportPadding = 8
      const availableBelow = window.innerHeight - buttonRect.bottom
      const shouldFlip = availableBelow < menuHeight + 16 && buttonRect.top > menuHeight + 16

      let left = buttonRect.left
      if (left + menuWidth > window.innerWidth - viewportPadding) {
        left = window.innerWidth - menuWidth - viewportPadding
      }
      left = Math.max(viewportPadding, left)

      const top = shouldFlip
        ? Math.max(viewportPadding, buttonRect.top - menuHeight - 8)
        : Math.min(window.innerHeight - menuHeight - viewportPadding, buttonRect.bottom + 8)

      setColumnSettingsPosition({
        left,
        top,
        placement: shouldFlip ? 'top' : 'bottom',
      })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [showColumnSettings, columnOrder, columnVisibility])

  // Track in-flight request versions to handle rapid changes
  const versionRef = useRef<Map<number, number>>(new Map())

  const orderedColumns = useMemo(() => {
    return normalizeColumnOrder(columnOrder)
      .map((columnKey) => LIST_VIEW_COLUMNS.find((column) => column.key === columnKey))
      .filter(Boolean) as ListViewColumn[]
  }, [columnOrder])

  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => columnVisibility[column.key]),
    [columnVisibility, orderedColumns],
  )

  const mobileVisibleColumns = useMemo(
    () => visibleColumns.filter((column) => !column.mobileHidden),
    [visibleColumns],
  )

  const settingsAnchorColumnKey = visibleColumns.some((column) => column.key === 'client')
    ? 'client'
    : visibleColumns[0]?.key

  const columnDensityClass =
    visibleColumns.length >= 8 ? 'text-[12.5px]' : visibleColumns.length >= 6 ? 'text-[13px]' : 'text-sm'

  const tableMinWidth = useMemo(() => {
    const widthMap: Record<string, number> = {
      client: 220,
      project: 230,
      status: 190,
      shootDate: 140,
      budget: 130,
      source: 150,
      team: 130,
      attachments: 110,
      location: 160,
    }

    return visibleColumns.reduce((total, column) => total + (widthMap[column.key] || 140), 0) + 108
  }, [visibleColumns])

  const updateColumnVisibility = (columnKey: string, value: boolean) => {
    const targetColumn = orderedColumns.find((column) => column.key === columnKey)

    if (!value && visibleColumns.length <= 1) {
      toast.info('Keep at least one column visible')
      return
    }

    if (!value && targetColumn && !targetColumn.mobileHidden && mobileVisibleColumns.length <= 1) {
      toast.info('Keep at least one mobile column visible')
      return
    }

    setColumnVisibility((prev) => {
      const next = {
        ...prev,
        [columnKey]: value,
      }
      persistColumnPreferences(next, columnOrder)
      return next
    })
  }

  const moveColumn = (draggedKey: string, targetKey: string) => {
    if (draggedKey === targetKey) return

    setColumnOrder((prev) => {
      const current = normalizeColumnOrder(prev)
      const draggedIndex = current.indexOf(draggedKey)
      const targetIndex = current.indexOf(targetKey)
      if (draggedIndex === -1 || targetIndex === -1) return current

      const nextOrder = [...current]
      const [movedColumn] = nextOrder.splice(draggedIndex, 1)
      nextOrder.splice(targetIndex, 0, movedColumn)
      persistColumnPreferences(columnVisibility, nextOrder)
      return nextOrder
    })
  }

  const nudgeColumn = (columnKey: string, direction: 'up' | 'down') => {
    const currentIndex = orderedColumns.findIndex((column) => column.key === columnKey)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetColumn = orderedColumns[targetIndex]
    if (!targetColumn) return

    moveColumn(columnKey, targetColumn.key)
  }

  const resetColumnPreferences = () => {
    const defaultsVisibility = getDefaultColumnVisibility()
    const defaultsOrder = getDefaultColumnOrder()
    setColumnVisibility(defaultsVisibility)
    setColumnOrder(defaultsOrder)
    persistColumnPreferences(defaultsVisibility, defaultsOrder)
    setShowColumnSettings(false)
  }

  const handleColumnDragStart = (event: DragEvent<HTMLButtonElement>, columnKey: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnKey)
    setDraggedColumnKey(columnKey)
  }

  const handleColumnDrop = (event: DragEvent<HTMLButtonElement>, targetKey: string) => {
    event.preventDefault()
    const sourceKey = event.dataTransfer.getData('text/plain') || draggedColumnKey
    if (sourceKey) {
      moveColumn(sourceKey, targetKey)
    }
    setDraggedColumnKey(null)
  }

  const handleStatusChange = async (castingId: number, newStatus: string) => {
    const casting = castings.find((c) => c.id === castingId)
    if (!casting || casting.status === newStatus) return

    const currentVersion = (versionRef.current.get(castingId) ?? 0) + 1
    versionRef.current.set(castingId, currentVersion)
    const thisVersion = currentVersion

    const oldStatus = casting.status

    setCastings((prev) =>
      prev.map((c) => (c.id === castingId ? { ...c, status: newStatus } : c)),
    )
    setUpdatingId(castingId)
    setFlashingId(castingId)
    setTimeout(() => {
      setFlashingId((prev) => (prev === castingId ? null : prev))
    }, 1000)

    try {
      await api.put(`/castings/${castingId}/status`, { status: newStatus })
      if (versionRef.current.get(castingId) === thisVersion) {
        setUpdatingId(null)
      }
    } catch {
      if (versionRef.current.get(castingId) === thisVersion) {
        setCastings((prev) =>
          prev.map((c) => (c.id === castingId ? { ...c, status: oldStatus } : c)),
        )
        setUpdatingId(null)
        toast.error('Failed to update status')
      }
    }
  }

  const handleOpenAttachments = async (casting: Casting, e: MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    const attachmentsCount = casting.attachments_count || 0
    const latestAttachmentUrl = casting.latest_attachment_url

    if (!attachmentsCount && !latestAttachmentUrl) {
      toast.info('No attachments uploaded for this casting yet')
      return
    }

    if (latestAttachmentUrl) {
      window.open(latestAttachmentUrl, '_blank', 'noopener,noreferrer')
      return
    }

    setLoadingAttachmentId(casting.id)
    try {
      const response = (await api.get(`/castings/${casting.id}/attachments`)) as {
        attachments?: Array<{ url?: string }>
      }
      const fallbackAttachmentUrl = response?.attachments?.[0]?.url
      if (!fallbackAttachmentUrl) {
        toast.info('No downloadable attachment found for this casting')
        return
      }
      window.open(fallbackAttachmentUrl, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Failed to open attachments')
    } finally {
      setLoadingAttachmentId((prev) => (prev === casting.id ? null : prev))
    }
  }

  const teamNamesForCasting = (casting: Casting) => {
    const assignedTo = casting.assigned_to as Array<string | { id?: number; name?: string }> | undefined
    if (Array.isArray(assignedTo)) {
      const names = assignedTo
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name || ''))
        .filter(Boolean)
      if (names.length > 0) return names
    }

    return parseAssignedNames(casting.assigned_names)
  }

  const getColumnClass = (column: ListViewColumn) => {
    if (column.desktopHidden) return 'hidden'
    if (column.mobileHidden) return 'hidden lg:table-cell'
    return ''
  }

  const renderColumnHeader = (column: ListViewColumn) => {
    const isSorted = sortConfig.key === column.sortKey

    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{column.label}</span>
        {isSorted &&
          (sortConfig.direction === 'asc' ? (
            <ChevronUp className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ))}
        {column.key === settingsAnchorColumnKey && (
          <div ref={settingsRef} className="ml-1">
            <button
              ref={settingsButtonRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setShowColumnSettings((prev) => !prev)
              }}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700',
                showColumnSettings && 'border-slate-200 bg-slate-100 text-slate-700',
              )}
              aria-label="Customize columns"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>

            {showColumnSettings && (
              <div
                ref={settingsMenuRef}
                className="fixed z-[120] w-64 max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl"
                style={{
                  left: columnSettingsPosition.left,
                  top: columnSettingsPosition.top,
                }}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">Customize columns</p>
                    <p className="text-[11px] text-slate-500">Toggle visibility and reorder columns.</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      resetColumnPreferences()
                    }}
                    className="text-[11px] font-semibold text-amber-600 hover:text-amber-700"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  {orderedColumns.map((orderedColumn) => {
                    const visibleCount = orderedColumns.filter((item) => columnVisibility[item.key]).length
                    const isLocked = visibleCount <= 1 && columnVisibility[orderedColumn.key]

                    return (
                      <button
                        key={orderedColumn.key}
                        type="button"
                        draggable
                        onDragStart={(event) => handleColumnDragStart(event, orderedColumn.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleColumnDrop(event, orderedColumn.key)}
                        onDragEnd={() => setDraggedColumnKey(null)}
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left transition',
                          draggedColumnKey === orderedColumn.key && 'border-amber-300 bg-amber-50',
                        )}
                      >
                        <span className="flex h-6 w-4 shrink-0 items-center justify-center text-[11px] leading-none text-slate-400">⋮⋮</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium leading-4 text-slate-800">{orderedColumn.label}</p>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              nudgeColumn(orderedColumn.key, 'up')
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={orderedColumns[0]?.key === orderedColumn.key}
                            aria-label={`Move ${orderedColumn.label} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              nudgeColumn(orderedColumn.key, 'down')
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={orderedColumns[orderedColumns.length - 1]?.key === orderedColumn.key}
                            aria-label={`Move ${orderedColumn.label} down`}
                          >
                            ↓
                          </button>
                          <label className="inline-flex h-6 items-center" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={Boolean(columnVisibility[orderedColumn.key])}
                              disabled={isLocked}
                              onChange={(event) =>
                                updateColumnVisibility(orderedColumn.key, event.target.checked)
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                            />
                          </label>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={cn('w-full table-auto', columnDensityClass)} style={{ minWidth: `${tableMinWidth}px` }}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => onSort(column.sortKey)}
                  className={cn(
                    'px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:bg-slate-100/80',
                    getColumnClass(column),
                  )}
                >
                  {renderColumnHeader(column)}
                </th>
              ))}
              <th className="sticky right-0 z-20 bg-slate-50/95 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[-12px_0_18px_-16px_rgba(15,23,42,0.35)] backdrop-blur">
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
              const sourceValue = formatSourceLabel(casting)
              const teamMembers = teamNamesForCasting(casting)
              const attachmentsCount = casting.attachments_count || 0
              const isAttachmentLoading = loadingAttachmentId === casting.id
              const phone = casting.client_contact?.trim()
              const normalizedPhone = phone ? phone.replace(/\D/g, '') : ''
              const readiness = getSubmissionReadiness(casting)
              const nextStep = getNextStepSignal(casting)
              const missingItems = getMissingWorkflowItems(casting)

              return (
                <tr
                  key={casting.id}
                  className={cn(
                    'border-b border-slate-100 transition-all',
                    isFlashing ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-slate-50/80',
                    isUpdating && 'pointer-events-none opacity-60',
                  )}
                >
                  {visibleColumns.map((column) => {
                    const tdClass = cn('px-3 py-3 align-middle', getColumnClass(column))

                    if (column.key === 'client') {
                      return (
                        <td
                          key={`${casting.id}-client`}
                          className={cn(tdClass, 'min-w-[220px] max-w-[240px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-semibold text-white shadow-sm">
                              {getInitials(casting.client_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{casting.client_name || '-'}</p>
                              <p className="truncate text-[11px] text-slate-500">{casting.client_company || 'Independent client'}</p>
                            </div>
                          </div>
                        </td>
                      )
                    }

                    if (column.key === 'project') {
                      return (
                        <td
                          key={`${casting.id}-project`}
                          className={cn(tdClass, 'min-w-[230px] max-w-[260px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900">{casting.project_name || '-'}</p>
                              </div>
                              {attachmentsCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(event) => handleOpenAttachments(casting, event)}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                                  title={`Open ${attachmentsCount} attachment${attachmentsCount > 1 ? 's' : ''}`}
                                >
                                  {isAttachmentLoading ? <CircularProgress size={12} /> : <Paperclip className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-medium', readiness.className)}>
                                {readiness.label}
                              </span>
                              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-medium', nextStep.className)}>
                                Next: {nextStep.label}
                              </span>
                              {missingItems.length > 0 && (
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600">
                                  {missingItems.length} gap{missingItems.length === 1 ? '' : 's'}
                                </span>
                              )}
                              {casting.location && !columnVisibility.location && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{casting.location}</span>
                              )}
                              {casting.source && !columnVisibility.source && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                  {casting.source_detail ? `${casting.source} · ${casting.source_detail}` : casting.source}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      )
                    }

                    if (column.key === 'status') {
                      return (
                        <td
                          key={`${casting.id}-status`}
                          className={cn(tdClass, 'min-w-[185px]')}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <FormControl size="small" fullWidth error={!currentStage}>
                            <Select
                              value={casting.status || ''}
                              onChange={(event) => handleStatusChange(casting.id, String(event.target.value))}
                              disabled={isUpdating}
                              displayEmpty
                              IconComponent={
                                isUpdating
                                  ? () => (
                                      <CircularProgress size={14} sx={{ mx: 1, color: 'text.secondary' }} />
                                    )
                                  : undefined
                              }
                              sx={{
                                fontSize: visibleColumns.length >= 8 ? '0.72rem' : '0.75rem',
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
                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                '& .MuiSelect-icon': { color: stageColor, right: 8 },
                                '&:hover .MuiSelect-select': { backgroundColor: `${stageColor}22` },
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
                                MenuListProps: { sx: { py: '4px' } },
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
                                    '&:hover': { backgroundColor: `${stage.color}18` },
                                    '&.Mui-selected': {
                                      backgroundColor: `${stage.color}14`,
                                      fontWeight: 600,
                                      '&:hover': { backgroundColor: `${stage.color}22` },
                                    },
                                  }}
                                >
                                  {stage.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </td>
                      )
                    }

                    if (column.key === 'shootDate') {
                      return (
                        <td
                          key={`${casting.id}-shootDate`}
                          className={cn(tdClass, 'min-w-[140px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          <p className="text-slate-700">{formatDate(casting.shoot_date_start) || '-'}</p>
                          {casting.shoot_date_end && casting.shoot_date_end !== casting.shoot_date_start && (
                            <p className="truncate text-[11px] text-slate-400">to {formatDate(casting.shoot_date_end)}</p>
                          )}
                        </td>
                      )
                    }

                    if (column.key === 'budget') {
                      return (
                        <td
                          key={`${casting.id}-budget`}
                          className={cn(tdClass, 'min-w-[130px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          {casting.budget_min || casting.budget_max ? (
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(casting.budget_min)}
                              {casting.budget_min && casting.budget_max && ' - '}
                              {formatCurrency(casting.budget_max)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )
                    }

                    if (column.key === 'source') {
                      return (
                        <td
                          key={`${casting.id}-source`}
                          className={cn(tdClass, 'min-w-[150px] max-w-[180px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          <span
                            className="inline-flex max-w-full items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                            title={sourceValue}
                          >
                            <span className="truncate">{sourceValue}</span>
                          </span>
                        </td>
                      )
                    }

                    if (column.key === 'team') {
                      return (
                        <td
                          key={`${casting.id}-team`}
                          className={cn(tdClass, 'min-w-[130px] max-w-[160px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          {teamMembers.length === 0 ? (
                            <span className="text-[11px] text-slate-400">Unassigned</span>
                          ) : (
                            <div className="flex items-center -space-x-2">
                              {teamMembers.slice(0, 3).map((memberName, index) => (
                                <span
                                  key={`${casting.id}-${memberName}-${index}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-700 shadow-sm"
                                  title={memberName}
                                >
                                  {getInitials(memberName)}
                                </span>
                              ))}
                              {teamMembers.length > 3 && (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-semibold text-slate-500 shadow-sm">
                                  +{teamMembers.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    }

                    if (column.key === 'attachments') {
                      return (
                        <td
                          key={`${casting.id}-attachments`}
                          className={cn(tdClass, 'min-w-[110px]')}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(event) => handleOpenAttachments(casting, event)}
                            disabled={isAttachmentLoading || !attachmentsCount}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                              attachmentsCount > 0
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100'
                                : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400',
                            )}
                          >
                            {isAttachmentLoading ? <CircularProgress size={12} /> : <Paperclip className="h-3.5 w-3.5" />}
                            <span>{attachmentsCount || 0}</span>
                          </button>
                        </td>
                      )
                    }

                    if (column.key === 'location') {
                      return (
                        <td
                          key={`${casting.id}-location`}
                          className={cn(tdClass, 'min-w-[160px] max-w-[180px]')}
                          onClick={() => !isUpdating && onCastingClick(casting)}
                        >
                          <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            <span className="truncate">{casting.location || '-'}</span>
                          </span>
                        </td>
                      )
                    }

                    return null
                  })}

                  <td className="sticky right-0 z-10 bg-white px-3 py-3 shadow-[-12px_0_18px_-16px_rgba(15,23,42,0.35)]">
                    <div className="flex items-center justify-end gap-1.5">
                      {normalizedPhone && (
                        <>
                          <a
                            href={`tel:${normalizedPhone}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                            aria-label="Call client"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(`Regarding ${casting.project_name || 'your casting'}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 transition hover:bg-green-100 hover:text-green-700"
                            aria-label="Message on WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
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
      <div className="w-full border-t border-slate-100" />
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
  setCastings: Dispatch<SetStateAction<Casting[]>>
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
        const readiness = getSubmissionReadiness(c)
        const nextStep = getNextStepSignal(c)
        const missingItems = getMissingWorkflowItems(c)

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
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      title="Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={'https://wa.me/' + c.client_contact.replace(/\D/g, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors"
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
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', readiness.className)}>
                  {readiness.label}
                </span>
                <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', nextStep.className)}>
                  Next: {nextStep.label}
                </span>
                {missingItems.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {missingItems.length} gap{missingItems.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{missingItems.length > 0 ? `Missing: ${missingItems.join(', ')}` : nextStep.note}</p>
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
              {teamNamesForCasting(c).length > 0 ? (
                <span
                  className="text-[11px] text-slate-400 truncate text-right flex-1 min-w-0 ml-1"
                  title={teamNamesForCasting(c).join(', ')}
                >
                  {teamNamesForCasting(c)[0]}
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

