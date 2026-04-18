import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Check, ChevronDown, ChevronUp, GitBranch, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'

export interface PipelineStage {
  id: number
  name: string
  color: string
  sort_order?: number
}

interface StageState extends PipelineStage {
  isEditing: boolean
  localName: string
  localColor: string
}

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const toList = (map: Map<number, StageState>): StageState[] =>
  Array.from(map.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

function StageCard({
  stage,
  index,
  totalCount,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isSaving,
  feedback,
}: {
  stage: StageState
  index: number
  totalCount: number
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isSaving: boolean
  feedback?: { msg: string; type: 'success' | 'error' }
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex items-center shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0 || isSaving}
          title="Move up"
          className="flex h-6 w-10 items-center justify-center rounded-lg transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-25 active:bg-slate-200"
        >
          <ChevronUp className="h-4 w-4 text-slate-400" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalCount - 1 || isSaving}
          title="Move down"
          className="flex h-6 w-10 items-center justify-center rounded-lg transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-25 active:bg-slate-200"
        >
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="h-3.5 w-3.5 shrink-0 rounded-full sm:h-4 sm:w-4" style={{ backgroundColor: stage.color }} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-800 sm:text-[15px]">{escapeHtml(stage.name)}</span>
          <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:inline-flex">
            Step {index + 1}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`hidden shrink-0 text-[11px] font-medium sm:block sm:text-xs ${feedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {feedback.msg}
          </motion.span>
        )}
      </AnimatePresence>

      <button
        onClick={onEdit}
        disabled={isSaving}
        title="Edit"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 sm:h-11 sm:w-11"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        onClick={onDelete}
        disabled={isSaving}
        title="Delete"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 disabled:opacity-40 sm:h-11 sm:w-11"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function StageEditRow({
  stage,
  onSave,
  onCancel,
  onColorChange,
  onNameChange,
  isSaving,
  error,
}: {
  stage: StageState
  onSave: () => void
  onCancel: () => void
  onColorChange: (color: string) => void
  onNameChange: (name: string) => void
  isSaving: boolean
  error?: string
}) {
  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <input
          type="color"
          value={stage.localColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white sm:h-11 sm:w-11"
          title="Pick color"
        />
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={stage.localName}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && stage.localName.trim()) onSave()
              if (e.key === 'Escape') onCancel()
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 sm:py-2.5 sm:text-[15px]"
            autoFocus
          />
          {error && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={isSaving || !stage.localName.trim()}
          title="Save"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          title="Cancel"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 disabled:opacity-40 sm:h-11 sm:w-11"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function AddStageForm({
  onAdd,
  onCancel,
  isSaving,
  error,
}: {
  onAdd: (name: string, color: string) => void
  onCancel: () => void
  isSaving: boolean
  error?: string
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, color)
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white sm:h-11 sm:w-11" title="Pick color" />
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) handleSubmit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="New stage name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 sm:py-2.5 sm:text-[15px]"
            autoFocus
          />
          {error && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
        <button onClick={handleSubmit} disabled={isSaving || !name.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
        <button onClick={onCancel} disabled={isSaving} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 disabled:opacity-40 sm:h-11 sm:w-11">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function PipelineStages() {
  const [stagesMap, setStagesMap] = useState<Map<number, StageState>>(new Map())
  const stages = toList(stagesMap)
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [savingSet, setSavingSet] = useState<Set<number>>(new Set())
  const [feedback, setFeedback] = useState<Map<number, { msg: string; type: 'success' | 'error' }>>(new Map())
  const [addError, setAddError] = useState('')
  const addingRef = useRef(false)

  const fetchStages = useCallback(async () => {
    try {
      const data: PipelineStage[] = await api.get('/settings/pipeline')
      const map = new Map<number, StageState>()
      data.forEach((s, idx) => {
        map.set(s.id, {
          ...s,
          sort_order: s.sort_order ?? idx,
          isEditing: false,
          localName: s.name,
          localColor: s.color,
        })
      })
      setStagesMap(map)
    } catch (err) {
      console.error('Failed to fetch stages:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStages() }, [fetchStages])

  const showFeedback = useCallback((id: number, msg: string, type: 'success' | 'error') => {
    setFeedback((prev) => {
      const next = new Map(prev)
      next.set(id, { msg, type })
      return next
    })
    setTimeout(() => {
      setFeedback((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, 3000)
  }, [])

  const startEdit = useCallback((id: number) => {
    setStagesMap((prev) => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) next.set(id, { ...item, isEditing: true, localName: item.name, localColor: item.color })
      return next
    })
  }, [])

  const cancelEdit = useCallback((id: number) => {
    setStagesMap((prev) => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) next.set(id, { ...item, isEditing: false, localName: item.name, localColor: item.color })
      return next
    })
  }, [])

  const updateLocal = useCallback((id: number, field: 'name' | 'color', value: string) => {
    setStagesMap((prev) => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) next.set(id, { ...item, [field === 'name' ? 'localName' : 'localColor']: value })
      return next
    })
    setFeedback((prev) => { const n = new Map(prev); n.delete(id); return n })
  }, [])

  const saveEdit = async (id: number) => {
    const item = stagesMap.get(id)
    if (!item) return
    const trimmed = item.localName.trim()
    if (!trimmed) return

    const duplicate = Array.from(stagesMap.values()).find((s) => s.id !== id && s.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (duplicate) {
      showFeedback(id, 'Name already exists', 'error')
      return
    }

    setSavingSet((prev) => new Set(prev).add(id))
    try {
      await api.put(`/settings/pipeline/${id}`, { name: trimmed, color: item.localColor })
      setStagesMap((prev) => {
        const next = new Map(prev)
        const s = next.get(id)
        if (s) next.set(id, { ...s, isEditing: false, name: s.localName, color: s.localColor })
        return next
      })
      showFeedback(id, 'Saved!', 'success')
    } catch (err) {
      console.error('Save failed:', err)
      await fetchStages()
      showFeedback(id, 'Save failed', 'error')
    } finally {
      setSavingSet((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const deleteStage = useCallback(async (id: number) => {
    if (!window.confirm('Delete this stage?')) return
    const name = stagesMap.get(id)?.name ?? ''
    setStagesMap((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setSavingSet((prev) => new Set(prev).add(id))
    try {
      await api.del(`/settings/pipeline/${id}`)
      showFeedback(id, `"${name}" deleted`, 'success')
    } catch (err) {
      console.error('Delete failed:', err)
      await fetchStages()
      showFeedback(id, 'Delete failed', 'error')
    } finally {
      setSavingSet((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [stagesMap, fetchStages, showFeedback])

  const moveUp = async (index: number) => {
    if (index === 0) return
    const reordered = [...stages]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    setStagesMap(new Map(withOrder.map((s) => [s.id, s])))
    try {
      await api.put('/settings/pipeline/reorder', { stages: withOrder.map((s) => ({ id: s.id, name: s.localName, color: s.localColor, sort_order: s.sort_order })) })
    } catch (err) {
      console.error('Reorder failed:', err)
      await fetchStages()
      showFeedback(-1, 'Reorder failed', 'error')
    }
  }

  const moveDown = async (index: number) => {
    if (index >= stages.length - 1) return
    const reordered = [...stages]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    setStagesMap(new Map(withOrder.map((s) => [s.id, s])))
    try {
      await api.put('/settings/pipeline/reorder', { stages: withOrder.map((s) => ({ id: s.id, name: s.localName, color: s.localColor, sort_order: s.sort_order })) })
    } catch (err) {
      console.error('Reorder failed:', err)
      await fetchStages()
      showFeedback(-1, 'Reorder failed', 'error')
    }
  }

  const handleAdd = async (trimmedName: string, color: string) => {
    const duplicate = Array.from(stagesMap.values()).find((s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase())
    if (duplicate) {
      setAddError('Name already exists')
      return
    }
    if (addingRef.current) return
    addingRef.current = true
    setSavingSet((prev) => new Set(prev).add(-1))
    try {
      const created: PipelineStage = await api.post('/settings/pipeline', { name: trimmedName, color })
      setStagesMap((prev) => {
        const next = new Map(prev)
        next.set(created.id, {
          ...created,
          sort_order: stages.length,
          isEditing: false,
          localName: created.name,
          localColor: created.color,
        })
        return next
      })
      setIsAdding(false)
      setAddError('')
      showFeedback(-1, `"${trimmedName}" added!`, 'success')
    } catch (err) {
      console.error('Add failed:', err)
      setAddError('Failed to add stage')
    } finally {
      addingRef.current = false
      setSavingSet((prev) => { const next = new Set(prev); next.delete(-1); return next })
    }
  }

  const stageNames = useMemo(() => stages.map((stage) => stage.name).join(' → '), [stages])
  const filteredStages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return stages
    return stages.filter((stage) => stage.name.toLowerCase().includes(query))
  }, [searchQuery, stages])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">Pipeline stages</h2>
          <p className="text-sm text-slate-500">Shape the core casting workflow so every job moves through a clear, consistent progression.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="btn-primary flex shrink-0 items-center gap-1.5 text-xs sm:text-sm disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add stage</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Stages</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{stages.length} in pipeline</p>
          <p className="mt-1 text-sm text-slate-500">Keep the funnel short enough that operators can choose the next state without hesitation.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <GitBranch className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Current flow</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">{stageNames || 'No stages yet'}</p>
          <p className="mt-1 text-sm text-slate-500">The sequence here defines how the casting pipeline reads across the product.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Workflow tip</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Name stages for decision points, not just generic status labels.</p>
          <p className="mt-1 text-sm text-slate-600">That makes dashboards, reports, and team handoffs much easier to scan later.</p>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Stage order</h3>
            <p className="text-sm text-slate-500">Keep the funnel easy to scan, especially when operators are working on mobile.</p>
          </div>
          <label className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm sm:max-w-xs">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search stages" className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400" />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <AnimatePresence>
            {filteredStages.map((stage) => {
              const index = stages.findIndex((item) => item.id === stage.id)
              return (
                <motion.div key={stage.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}>
                  {stage.isEditing ? (
                    <StageEditRow
                      stage={stage}
                      onSave={() => saveEdit(stage.id)}
                      onCancel={() => cancelEdit(stage.id)}
                      onColorChange={(color) => updateLocal(stage.id, 'color', color)}
                      onNameChange={(name) => updateLocal(stage.id, 'name', name)}
                      isSaving={savingSet.has(stage.id)}
                    />
                  ) : (
                    <StageCard
                      stage={stage}
                      index={index}
                      totalCount={stages.length}
                      onEdit={() => startEdit(stage.id)}
                      onDelete={() => deleteStage(stage.id)}
                      onMoveUp={() => moveUp(index)}
                      onMoveDown={() => moveDown(index)}
                      isSaving={savingSet.has(stage.id)}
                      feedback={feedback.get(stage.id)}
                    />
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>

          <AnimatePresence>
            {isAdding && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <AddStageForm onAdd={handleAdd} onCancel={() => { setIsAdding(false); setAddError('') }} isSaving={savingSet.has(-1)} error={addError} />
              </motion.div>
            )}
          </AnimatePresence>

          {stages.length === 0 && !isAdding && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline setup</p>
              <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">No stages added yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Add the first stage to define how TOABH should move a casting from intake to confirmed outcome.</p>
              <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">This becomes the backbone for kanban, reporting, status filters, and operator handoffs.</p>
            </div>
          )}

          {stages.length > 0 && filteredStages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">No stages match that search</p>
              <p className="mt-2 text-sm text-slate-500">Clear the search to review the full sequence and reorder it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
