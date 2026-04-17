import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Check, Loader2, Pencil, Plus, Radio, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface LeadSource {
  id: number
  name: string
}

interface SourceState extends LeadSource {
  isEditing: boolean
  localChanges: { name: string }
}

function SourceCard({
  source,
  onEdit,
  onDelete,
  isSaving,
  feedback,
}: {
  source: SourceState
  onEdit: () => void
  onDelete: () => void
  isSaving: boolean
  feedback?: { msg: string; type: 'success' | 'error' }
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md sm:px-4 sm:py-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 sm:text-[15px]">
        {escapeHtml(source.name)}
      </span>
      <AnimatePresence>
        {feedback && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`hidden shrink-0 text-[11px] font-medium sm:block sm:text-xs ${
              feedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'
            }`}
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

function SourceEditRow({
  source,
  onSave,
  onCancel,
  onChange,
  isSaving,
  error,
}: {
  source: SourceState
  onSave: () => void
  onCancel: () => void
  onChange: (v: string) => void
  isSaving: boolean
  error?: string
}) {
  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={source.localChanges.name}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && source.localChanges.name.trim()) onSave()
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
          disabled={isSaving || !source.localChanges.name.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 disabled:opacity-40 sm:h-11 sm:w-11"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function LeadSources() {
  const [sourcesMap, setSourcesMap] = useState<Map<number, SourceState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Map<number, { msg: string; type: 'success' | 'error' }>>(new Map())
  const [validationError, setValidationError] = useState('')

  const fetchSources = useCallback(async () => {
    try {
      const data = await api.get('/settings/sources')
      const safeData: LeadSource[] = Array.isArray(data) ? data : []
      const map = new Map<number, SourceState>()
      safeData.forEach((s) => {
        map.set(s.id, {
          ...s,
          isEditing: false,
          localChanges: { name: s.name },
        })
      })
      setSourcesMap(map)
    } catch (err) {
      console.error('Failed to fetch sources:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

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
    setSourcesMap((prev) => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, { ...item, isEditing: true, localChanges: { name: item.name } })
      }
      return next
    })
  }, [])

  const cancelEdit = useCallback((id: number) => {
    setSourcesMap((prev) => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, { ...item, isEditing: false, localChanges: { name: item.name } })
      }
      return next
    })
    setValidationError('')
  }, [])

  const updateLocal = useCallback((id: number, value: string) => {
    setSourcesMap((prev) => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, { ...item, localChanges: { name: value } })
      }
      return next
    })
    setValidationError('')
  }, [])

  const saveEdit = useCallback(async (id: number) => {
    const item = sourcesMap.get(id)
    if (!item) return
    const trimmedName = item.localChanges.name.trim()
    if (!trimmedName) {
      setValidationError('Name is required')
      return
    }
    setSaving(id)
    setValidationError('')
    try {
      await api.put(`/settings/sources/${id}`, { name: trimmedName })
      setSourcesMap((prev) => {
        const next = new Map(prev)
        next.set(id, { ...item, name: trimmedName, isEditing: false, localChanges: { name: trimmedName } })
        return next
      })
      showFeedback(id, 'Saved!', 'success')
    } catch (err) {
      console.error('Failed to save:', err)
      showFeedback(id, 'Failed to save', 'error')
    } finally {
      setSaving(null)
    }
  }, [showFeedback, sourcesMap])

  const deleteSource = useCallback(async (id: number) => {
    if (!window.confirm('Delete this source?')) return
    try {
      await api.del(`/settings/sources/${id}`)
      setSourcesMap((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      showFeedback(id, 'Deleted!', 'success')
    } catch (err) {
      console.error('Failed to delete:', err)
      showFeedback(id, 'Failed to delete', 'error')
    }
  }, [showFeedback])

  const handleAdd = async () => {
    const trimmedName = newItem.trim()
    if (!trimmedName) {
      setValidationError('Name is required')
      return
    }
    setSaving(-1)
    setValidationError('')
    try {
      const created: LeadSource = await api.post('/settings/sources', { name: trimmedName })
      setSourcesMap((prev) => {
        const next = new Map(prev)
        next.set(created.id, { ...created, isEditing: false, localChanges: { name: created.name } })
        return next
      })
      setNewItem('')
      setIsAdding(false)
      showFeedback(-1, 'Source added!', 'success')
    } catch (err) {
      console.error('Failed to add:', err)
      setValidationError('Failed to add source')
    } finally {
      setSaving(null)
    }
  }

  const handleCancelAdd = () => {
    setIsAdding(false)
    setNewItem('')
    setValidationError('')
  }

  const sources = Array.from(sourcesMap.values())
  const sourcesCount = sources.length
  const draftCount = useMemo(() => sources.filter((source) => source.isEditing).length, [sources])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">Lead sources</h2>
          <p className="text-sm text-slate-500">Track where opportunities are coming from so TOABH can see which channels actually drive demand.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="btn-primary flex shrink-0 items-center gap-1.5 text-xs sm:text-sm disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add source</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sources</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{sourcesCount} active</p>
          <p className="mt-1 text-sm text-slate-500">Keep names tight and recognizable so operators can tag new leads quickly.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Radio className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">In progress</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{draftCount} source edits open</p>
          <p className="mt-1 text-sm text-slate-500">Use one clean source per origin channel instead of lots of near-duplicate names.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Pipeline note</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Source quality matters more than source quantity.</p>
          <p className="mt-1 text-sm text-slate-600">A smaller, well-labeled source list makes reporting and attribution much cleaner later.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {sources.map((source) => (
            <motion.div key={source.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}>
              {source.isEditing ? (
                <SourceEditRow
                  source={source}
                  onSave={() => saveEdit(source.id)}
                  onCancel={() => cancelEdit(source.id)}
                  onChange={(v) => updateLocal(source.id, v)}
                  isSaving={saving === source.id}
                  error={validationError && !source.localChanges.name.trim() ? validationError : undefined}
                />
              ) : (
                <SourceCard
                  source={source}
                  onEdit={() => startEdit(source.id)}
                  onDelete={() => deleteSource(source.id)}
                  isSaving={saving === source.id}
                  feedback={feedback.get(source.id)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isAdding && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => { setNewItem(e.target.value); setValidationError('') }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newItem.trim()) handleAdd()
                        if (e.key === 'Escape') handleCancelAdd()
                      }}
                      placeholder="Source name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 sm:py-2.5 sm:text-[15px]"
                      autoFocus
                    />
                    {validationError && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {validationError}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={saving === -1 || !newItem.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
                  >
                    {saving === -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleCancelAdd}
                    disabled={saving === -1}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 disabled:opacity-40 sm:h-11 sm:w-11"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sources.length === 0 && !isAdding && (
          <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Lead pipeline</p>
            <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">No lead sources added yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Add your first source to keep inbound leads organized across referrals, Instagram, agencies, and direct outreach.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">Once sources are defined, this becomes the intake map for where the strongest TOABH demand is coming from.</p>
          </div>
        )}
      </div>
    </div>
  )
}
