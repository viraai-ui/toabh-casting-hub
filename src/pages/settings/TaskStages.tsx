import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { TaskStage } from '@/types'

export function TaskStages() {
  const [stages, setStages] = useState<TaskStage[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newStage, setNewStage] = useState({ name: '', color: '#6366f1' })
  const [searchQuery, setSearchQuery] = useState('')

  const loadStages = async () => {
    setLoading(true)
    try {
      const data = await api.get('/settings/task-stages')
      setStages(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadStages() }, [])

  const saveAll = async (nextStages: TaskStage[]) => {
    setStages(nextStages)
    setSaving(true)
    try {
      await api.put('/settings/task-stages', { stages: nextStages.map((stage, index) => ({ ...stage, sort_order: index })) })
    } finally {
      setSaving(false)
    }
  }

  const orderedStageNames = useMemo(() => stages.map((stage) => stage.name).join(' → '), [stages])
  const filteredStages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return stages
    return stages.filter((stage) => stage.name.toLowerCase().includes(query))
  }, [searchQuery, stages])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Task stages</h2>
          <p className="text-sm text-slate-500">Manage the status ladder that operators use to move work forward.</p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-auto">
          {saving && <span className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">Saving…</span>}
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Add stage</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pipeline size</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{stages.length} stage{stages.length === 1 ? '' : 's'} configured</p>
          <p className="mt-1 text-sm text-slate-500">Keep this list focused enough that operators can pick the next status quickly.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current order</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{orderedStageNames || 'No stages yet'}</p>
          <p className="mt-1 text-sm text-slate-500">The order here drives how the execution queue reads across the product.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Operator note</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Use fewer, clearer stages over highly specific micro-statuses.</p>
          <p className="mt-1 text-sm text-slate-600">It keeps mobile triage faster and reduces hesitation when updating work.</p>
        </div>
      </div>

      {creating && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Stage name</label>
                <input value={newStage.name} onChange={(e) => setNewStage((c) => ({ ...c, name: e.target.value }))} placeholder="Awaiting approval" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Stage color</label>
                <input type="color" value={newStage.color} onChange={(e) => setNewStage((c) => ({ ...c, color: e.target.value }))} className="h-[46px] w-full rounded-2xl border border-slate-200 bg-white" />
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preview</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: newStage.color }} />
                <span className="text-sm font-medium text-slate-800">{newStage.name || 'New task stage'}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={async () => { await api.post('/settings/task-stages', newStage); setCreating(false); setNewStage({ name: '', color: '#6366f1' }); loadStages() }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-medium text-white"><Check className="h-4 w-4" />Create stage</button>
            <button onClick={() => setCreating(false)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-medium text-slate-600"><X className="h-4 w-4" />Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Task flow directory</h3>
            <p className="text-sm text-slate-500">Review ordering, find a stage quickly, and keep the working list compact.</p>
          </div>
          <label className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm sm:max-w-xs">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search task stages" className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400" />
          </label>
        </div>

        <div className="mt-4">
      {stages.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <Plus className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-base font-semibold text-slate-900">No task stages yet</h3>
          <p className="mt-2 text-sm text-slate-500">Create the first stage so tasks can move through a clear operating flow.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStages.map((stage) => {
            const index = stages.findIndex((item) => item.id === stage.id)
            return (
            <div key={stage.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: stage.color }} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{stage.name}</p>
                    <p className="text-xs text-slate-500">Position {index + 1} in the task flow</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => index > 0 && saveAll(stages.map((s, i, arr) => i === index ? arr[index - 1] : i === index - 1 ? arr[index] : s))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><ArrowUp className="h-4 w-4" />Move up</button>
                  <button onClick={() => index < stages.length - 1 && saveAll(stages.map((s, i, arr) => i === index ? arr[index + 1] : i === index + 1 ? arr[index] : s))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><ArrowDown className="h-4 w-4" />Move down</button>
                  <button onClick={() => {
                    const name = prompt('Rename stage', stage.name)
                    if (!name) return
                    saveAll(stages.map((s) => s.id === stage.id ? { ...s, name } : s))
                  }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Pencil className="h-4 w-4" />Rename</button>
                  <button onClick={() => stages.length > 1 && saveAll(stages.filter((s) => s.id !== stage.id))} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete</button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <ChevronUp className="h-3.5 w-3.5" />
                <ChevronDown className="h-3.5 w-3.5" />
                Drag-free ordering keeps this surface simpler on mobile.
              </div>
            </div>
          )})}

          {filteredStages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">No task stages match that search</p>
              <p className="mt-2 text-sm text-slate-500">Clear the search to review the full task ladder.</p>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
