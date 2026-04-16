import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, Check, X, AlertCircle } from 'lucide-react'
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
    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm hover:shadow-md transition-shadow">
      <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-medium text-slate-800 truncate">
        {escapeHtml(source.name)}
      </span>
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
      <button
        onClick={onEdit}
        disabled={isSaving}
        title="Edit"
        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 disabled:opacity-40 active:scale-95 transition-all"
      >
        <Pencil className="w-4 h-4" />
      </button>
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
    <div className="bg-amber-50/60 rounded-xl border-2 border-amber-200 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={source.localChanges.name}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && source.localChanges.name.trim()) onSave()
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
        <button
          onClick={onSave}
          disabled={isSaving || !source.localChanges.name.trim()}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
      safeData.forEach(s => {
        map.set(s.id, {
          ...s,
          isEditing: false,
          localChanges: { name: s.name }
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
    setSourcesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: true,
          localChanges: { name: item.name }
        })
      }
      return next
    })
  }, [])

  const cancelEdit = useCallback((id: number) => {
    setSourcesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: false,
          localChanges: { name: item.name }
        })
      }
      return next
    })
    setValidationError('')
  }, [])

  const updateLocal = useCallback((id: number, value: string) => {
    setSourcesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          localChanges: { name: value }
        })
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
      setSourcesMap(prev => {
        const next = new Map(prev)
        next.set(id, {
          ...item,
          name: trimmedName,
          isEditing: false,
          localChanges: { name: trimmedName }
        })
        return next
      })
      showFeedback(id, 'Saved!', 'success')
    } catch (err) {
      console.error('Failed to save:', err)
      showFeedback(id, 'Failed to save', 'error')
      // Rollback
      setSourcesMap(prev => {
        const next = new Map(prev)
        const orig = next.get(id)
        if (orig) {
          next.set(id, {
            ...orig,
            localChanges: { name: orig.name }
          })
        }
        return next
      })
    } finally {
      setSaving(null)
    }
  }, [sourcesMap, showFeedback])

  const deleteSource = useCallback(async (id: number) => {
    if (!window.confirm('Delete this source?')) return
    try {
      await api.del(`/settings/sources/${id}`)
      setSourcesMap(prev => {
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
      setSourcesMap(prev => {
        const next = new Map(prev)
        next.set(created.id, {
          ...created,
          isEditing: false,
          localChanges: { name: created.name }
        })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  const sources = Array.from(sourcesMap.values())

  return (
    <div className="flex flex-col gap-4">
      {/* Header: title + count + add button */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">Lead Sources</h2>
          <p className="text-xs sm:text-sm text-slate-400">{sources.length} source{sources.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm shrink-0 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Add Source</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Sources list */}
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {sources.map((source) => (
            <motion.div
              key={source.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              {source.isEditing ? (
                <SourceEditRow
                  source={source}
                  onSave={() => saveEdit(source.id)}
                  onCancel={() => cancelEdit(source.id)}
                  onChange={v => updateLocal(source.id, v)}
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

        {/* Add form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="bg-amber-50/60 rounded-xl border-2 border-amber-300 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={newItem}
                      onChange={e => { setNewItem(e.target.value); setValidationError('') }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newItem.trim()) handleAdd()
                        if (e.key === 'Escape') handleCancelAdd()
                      }}
                      placeholder="Source name"
                      className="w-full px-3 py-2 sm:py-2.5 border border-slate-200 rounded-xl bg-white text-sm sm:text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400"
                      autoFocus
                    />
                    {validationError && (
                      <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationError}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={saving === -1 || !newItem.trim()}
                    className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                  >
                    {saving === -1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancelAdd}
                    disabled={saving === -1}
                    className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 disabled:opacity-40 transition-all shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sources.length === 0 && !isAdding && (
          <div className="text-center py-12 px-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Lead pipeline</p>
            <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">No lead sources added yet</p>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Add your first source to keep inbound leads organized across referrals, Instagram, agencies, and direct outreach.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
