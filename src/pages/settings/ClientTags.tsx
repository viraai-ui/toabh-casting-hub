import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { ClientTag } from '@/types'
import { ClientTagPill } from '@/components/clients/ClientTagPill'

interface ClientTagState extends ClientTag {
  usage_count?: number
  isEditing: boolean
  draftName: string
  draftColor: string
}

const DEFAULT_COLOR = '#f59e0b'

function TagCard({
  tag,
  onEdit,
  onDelete,
  isSaving,
  feedback,
}: {
  tag: ClientTagState
  onEdit: () => void
  onDelete: () => void
  isSaving: boolean
  feedback?: { msg: string; type: 'success' | 'error' }
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <ClientTagPill tag={tag} className="text-xs" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{tag.name}</p>
        <p className="text-xs text-slate-500">{tag.usage_count ?? 0} client{(tag.usage_count ?? 0) === 1 ? '' : 's'}</p>
      </div>
      <AnimatePresence>
        {feedback && (
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`hidden text-xs font-medium sm:block ${feedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {feedback.msg}
          </motion.span>
        )}
      </AnimatePresence>
      <button
        onClick={onEdit}
        disabled={isSaving}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
        title="Edit tag"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        disabled={isSaving}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
        title="Delete tag"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function TagEditRow({
  tag,
  onSave,
  onCancel,
  onNameChange,
  onColorChange,
  isSaving,
  error,
}: {
  tag: ClientTagState
  onSave: () => void
  onCancel: () => void
  onNameChange: (value: string) => void
  onColorChange: (value: string) => void
  isSaving: boolean
  error?: string
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          type="color"
          value={tag.draftColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="mt-1 h-11 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white"
          title="Pick tag color"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <input
            type="text"
            value={tag.draftName}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && tag.draftName.trim()) onSave()
              if (event.key === 'Escape') onCancel()
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            autoFocus
          />
          {error && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={isSaving || !tag.draftName.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function ClientTags() {
  const [tags, setTags] = useState<ClientTagState[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLOR)
  const [savingId, setSavingId] = useState<number | 'new' | null>(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<Map<number, { msg: string; type: 'success' | 'error' }>>(new Map())

  const showFeedback = useCallback((id: number, msg: string, type: 'success' | 'error') => {
    setFeedback((prev) => new Map(prev).set(id, { msg, type }))
    window.setTimeout(() => {
      setFeedback((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, 2600)
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get('/settings/client-tags')
      const safeData = Array.isArray(data) ? data : []
      setTags(
        safeData.map((tag: ClientTag & { usage_count?: number }) => ({
          ...tag,
          usage_count: tag.usage_count ?? 0,
          isEditing: false,
          draftName: tag.name,
          draftColor: tag.color,
        })),
      )
    } catch (err) {
      console.error('Failed to load client tags', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const totalUsage = useMemo(() => tags.reduce((sum, tag) => sum + (tag.usage_count ?? 0), 0), [tags])

  const startEdit = (id: number) => {
    setTags((prev) =>
      prev.map((tag) =>
        tag.id === id
          ? { ...tag, isEditing: true, draftName: tag.name, draftColor: tag.color }
          : { ...tag, isEditing: false },
      ),
    )
    setError('')
  }

  const cancelEdit = (id: number) => {
    setTags((prev) =>
      prev.map((tag) =>
        tag.id === id
          ? { ...tag, isEditing: false, draftName: tag.name, draftColor: tag.color }
          : tag,
      ),
    )
    setError('')
  }

  const saveEdit = async (id: number) => {
    const current = tags.find((tag) => tag.id === id)
    if (!current) return

    const name = current.draftName.trim()
    if (!name) {
      setError('Tag name is required')
      return
    }

    setSavingId(id)
    setError('')
    try {
      const updated = await api.put(`/settings/client-tags/${id}`, {
        name,
        color: current.draftColor,
      })
      setTags((prev) =>
        prev.map((tag) =>
          tag.id === id
            ? {
                ...tag,
                ...(updated as ClientTagState),
                usage_count: (updated as ClientTagState).usage_count ?? tag.usage_count ?? 0,
                isEditing: false,
                draftName: (updated as ClientTagState).name,
                draftColor: (updated as ClientTagState).color,
              }
            : tag,
        ),
      )
      showFeedback(id, 'Saved', 'success')
    } catch (err) {
      console.error('Failed to update client tag', err)
      setError('Could not save tag right now')
    } finally {
      setSavingId(null)
    }
  }

  const createTag = async () => {
    const name = newTagName.trim()
    if (!name) {
      setError('Tag name is required')
      return
    }

    setSavingId('new')
    setError('')
    try {
      const created = (await api.post('/settings/client-tags', {
        name,
        color: newTagColor,
      })) as ClientTag & { usage_count?: number }
      setTags((prev) => [
        {
          ...created,
          usage_count: created.usage_count ?? 0,
          isEditing: false,
          draftName: created.name,
          draftColor: created.color,
        },
        ...prev,
      ])
      setIsAdding(false)
      setNewTagName('')
      setNewTagColor(DEFAULT_COLOR)
    } catch (err) {
      console.error('Failed to create client tag', err)
      setError('Could not create tag right now')
    } finally {
      setSavingId(null)
    }
  }

  const deleteTag = async (tag: ClientTagState) => {
    if (!window.confirm(`Delete tag “${tag.name}”? It will be removed from all tagged clients.`)) {
      return
    }

    setSavingId(tag.id)
    try {
      await api.del(`/settings/client-tags/${tag.id}`)
      setTags((prev) => prev.filter((item) => item.id !== tag.id))
    } catch (err) {
      console.error('Failed to delete client tag', err)
      showFeedback(tag.id, 'Delete failed', 'error')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-amber-50/60 to-orange-50 px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              <Tag className="h-3.5 w-3.5" />
              Client Tags
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Organize clients with reusable color tags</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create custom labels for agencies, priorities, verticals, or any workflow you want your team to spot instantly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Tags</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{tags.length}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Assignments</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalUsage}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Manage tags</h3>
            <p className="text-sm text-slate-500">Every tag can have a custom name and color.</p>
          </div>
          {!isAdding && (
            <button
              onClick={() => {
                setIsAdding(true)
                setError('')
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              <Plus className="h-4 w-4" />
              Add Tag
            </button>
          )}
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4"
            >
              <div className="flex items-start gap-3">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(event) => setNewTagColor(event.target.value)}
                  className="mt-1 h-11 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(event) => setNewTagName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && newTagName.trim()) createTag()
                      if (event.key === 'Escape') setIsAdding(false)
                    }}
                    placeholder="e.g. VIP, Fashion, High Priority"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    autoFocus
                  />
                  {error && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {error}
                    </p>
                  )}
                </div>
                <button
                  onClick={createTag}
                  disabled={savingId === 'new' || !newTagName.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false)
                    setError('')
                  }}
                  disabled={savingId === 'new'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
            </div>
          ) : tags.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Client tags</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">No client tags yet</p>
              <p className="mt-2 text-sm text-slate-500">Create your first tag to start grouping clients visually and shaping relationship views.</p>
            </div>
          ) : (
            tags.map((tag) =>
              tag.isEditing ? (
                <TagEditRow
                  key={tag.id}
                  tag={tag}
                  onSave={() => saveEdit(tag.id)}
                  onCancel={() => cancelEdit(tag.id)}
                  onNameChange={(value) => {
                    setTags((prev) => prev.map((item) => (item.id === tag.id ? { ...item, draftName: value } : item)))
                    setError('')
                  }}
                  onColorChange={(value) => {
                    setTags((prev) => prev.map((item) => (item.id === tag.id ? { ...item, draftColor: value } : item)))
                    setError('')
                  }}
                  isSaving={savingId === tag.id}
                  error={error}
                />
              ) : (
                <TagCard
                  key={tag.id}
                  tag={tag}
                  onEdit={() => startEdit(tag.id)}
                  onDelete={() => deleteTag(tag)}
                  isSaving={savingId === tag.id}
                  feedback={feedback.get(tag.id)}
                />
              ),
            )
          )}
        </div>
      </section>
    </div>
  )
}
