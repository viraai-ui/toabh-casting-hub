import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Check, X, AlertCircle } from 'lucide-react'
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

// ─────────────────────────────────────────────────────────────────────────────
// StageCard — display row: color dot + name + actions in one line
// ─────────────────────────────────────────────────────────────────────────────
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
    <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Reorder — two vertically stacked arrows in one column */}
      <div className="flex items-center shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0 || isSaving}
          title="Move up"
          className="w-10 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed active:bg-slate-200 transition-all"
        >
          <ChevronUp className="w-4 h-4 text-slate-400" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalCount - 1 || isSaving}
          title="Move down"
          className="w-10 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed active:bg-slate-200 transition-all"
        >
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Color dot */}
      <div
        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: stage.color }}
      />

      {/* Stage name — truncate to prevent overflow */}
      <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-medium text-slate-800 truncate">
        {escapeHtml(stage.name)}
      </span>

      {/* Inline feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`shrink-0 text-[11px] sm:text-xs font-medium hidden sm:block ${
              feedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {feedback.msg}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Edit */}
      <button
        onClick={onEdit}
        disabled={isSaving}
        title="Edit"
        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 disabled:opacity-40 active:scale-95 transition-all"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={isSaving}
        title="Delete"
        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 disabled:opacity-40 active:scale-95 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StageEditRow — inline edit form: color + name input + save + cancel
// ─────────────────────────────────────────────────────────────────────────────
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
    <div className="bg-amber-50/60 rounded-xl border-2 border-amber-200 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Color picker */}
        <input
          type="color"
          value={stage.localColor}
          onChange={e => onColorChange(e.target.value)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl cursor-pointer flex-shrink-0 border border-slate-200 bg-white"
          title="Pick color"
        />

        {/* Name input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={stage.localName}
            onChange={e => onNameChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && stage.localName.trim()) onSave()
              if (e.key === 'Escape') onCancel()
            }}
            className="w-full px-3 py-2 sm:py-2.5 border border-slate-200 rounded-xl bg-white text-sm sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400"
            autoFocus
          />
          {error && (
            <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>

        {/* Save */}
        <button
          onClick={onSave}
          disabled={isSaving || !stage.localName.trim()}
          title="Save"
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
        >
          {isSaving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Check className="w-4 h-4" />
          }
        </button>

        {/* Cancel */}
        <button
          onClick={onCancel}
          disabled={isSaving}
          title="Cancel"
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 disabled:opacity-40 transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AddStageForm — add new stage form
// ─────────────────────────────────────────────────────────────────────────────
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
    <div className="bg-amber-50/60 rounded-xl border-2 border-amber-300 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl cursor-pointer flex-shrink-0 border border-slate-200 bg-white"
          title="Pick color"
        />
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) handleSubmit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="New stage name"
            className="w-full px-3 py-2 sm:py-2.5 border border-slate-200 rounded-xl bg-white text-sm sm:text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400"
            autoFocus
          />
          {error && (
            <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSaving || !name.trim()}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
        >
          {isSaving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Plus className="w-4 h-4" />
          }
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 disabled:opacity-40 transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
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
    setFeedback(prev => {
      const next = new Map(prev)
      next.set(id, { msg, type })
      return next
    })
    setTimeout(() => {
      setFeedback(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, 3000)
  }, [])

  const startEdit = useCallback((id: number) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, { ...item, isEditing: true, localName: item.name, localColor: item.color })
      }
      return next
    })
  }, [])

  const cancelEdit = useCallback((id: number) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, { ...item, isEditing: false, localName: item.name, localColor: item.color })
      }
      return next
    })
  }, [])

  const updateLocal = useCallback((id: number, field: 'name' | 'color', value: string) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, { ...item, [field === 'name' ? 'localName' : 'localColor']: value })
      }
      return next
    })
    setFeedback(prev => { const n = new Map(prev); n.delete(id); return n })
  }, [])

  const saveEdit = async (id: number) => {
    const item = stagesMap.get(id)
    if (!item) return
    const trimmed = item.localName.trim()
    if (!trimmed) return

    const duplicate = Array.from(stagesMap.values()).find(
      s => s.id !== id && s.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      showFeedback(id, 'Name already exists', 'error')
      return
    }

    setSavingSet(prev => new Set(prev).add(id))
    try {
      await api.put(`/settings/pipeline/${id}`, { name: trimmed, color: item.localColor })
      setStagesMap(prev => {
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
      setSavingSet(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const deleteStage = useCallback(async (id: number) => {
    if (!window.confirm('Delete this stage?')) return
    const name = stagesMap.get(id)?.name ?? ''

    setStagesMap(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setSavingSet(prev => new Set(prev).add(id))

    try {
      await api.del(`/settings/pipeline/${id}`)
      showFeedback(id, `"${name}" deleted`, 'success')
    } catch (err) {
      console.error('Delete failed:', err)
      await fetchStages()
      showFeedback(id, 'Delete failed', 'error')
    } finally {
      setSavingSet(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [stagesMap, fetchStages, showFeedback])

  const moveUp = async (index: number) => {
    if (index === 0) return
    const reordered = [...stages]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    setStagesMap(new Map(withOrder.map(s => [s.id, s])))
    try {
      await api.put('/settings/pipeline/reorder', {
        stages: withOrder.map(s => ({ id: s.id, name: s.localName, color: s.localColor, sort_order: s.sort_order }))
      })
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
    setStagesMap(new Map(withOrder.map(s => [s.id, s])))
    try {
      await api.put('/settings/pipeline/reorder', {
        stages: withOrder.map(s => ({ id: s.id, name: s.localName, color: s.localColor, sort_order: s.sort_order }))
      })
    } catch (err) {
      console.error('Reorder failed:', err)
      await fetchStages()
      showFeedback(-1, 'Reorder failed', 'error')
    }
  }

  const handleAdd = async (trimmedName: string, color: string) => {
    const duplicate = Array.from(stagesMap.values()).find(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      setAddError('Name already exists')
      return
    }

    if (addingRef.current) return
    addingRef.current = true
    setSavingSet(prev => new Set(prev).add(-1))

    try {
      const created: PipelineStage = await api.post('/settings/pipeline', {
        name: trimmedName,
        color,
      })
      setStagesMap(prev => {
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
      setSavingSet(prev => { const next = new Set(prev); next.delete(-1); return next })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header: title + count + add button */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">Pipeline Stages</h2>
          <p className="text-xs sm:text-sm text-slate-400">{stages.length} stage{stages.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm shrink-0 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Add Stage</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Stages list */}
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {stages.map((stage, index) => {
            const isSaving = savingSet.has(stage.id)
            const fb = feedback.get(stage.id)

            return (
              <motion.div
                key={stage.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
              >
                {stage.isEditing ? (
                  <StageEditRow
                    stage={stage}
                    onSave={() => saveEdit(stage.id)}
                    onCancel={() => cancelEdit(stage.id)}
                    onColorChange={v => updateLocal(stage.id, 'color', v)}
                    onNameChange={v => updateLocal(stage.id, 'name', v)}
                    isSaving={isSaving}
                    error={fb?.type === 'error' ? fb.msg : undefined}
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
                    isSaving={isSaving}
                    feedback={fb}
                  />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Add new form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <AddStageForm
                onAdd={handleAdd}
                onCancel={() => { setIsAdding(false); setAddError('') }}
                isSaving={savingSet.has(-1)}
                error={addError}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {stages.length === 0 && !isAdding && (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline stages</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">No pipeline stages yet</p>
            <p className="mt-2 text-sm text-slate-500">Add the first stage above to define how jobs move through the agency workflow.</p>
            <p className="mt-2 text-xs text-slate-400">Once stages are defined, the entire casting pipeline gets a clearer operating rhythm from intake to closure.</p>
            <p className="mt-2 text-xs text-slate-400">It also keeps the team aligned on what each step means before a job advances.</p>
          </div>
        )}
      </div>
    </div>
  )
}
