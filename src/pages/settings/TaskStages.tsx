import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { TaskStage } from '@/types'

export function TaskStages() {
  const [stages, setStages] = useState<TaskStage[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newStage, setNewStage] = useState({ name: '', color: '#6366f1' })

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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Task Stages</h2>
          <p className="text-sm text-slate-500">Manage the statuses used across Tasks.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Add Stage</button>
      </div>

      {creating && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
            <input value={newStage.name} onChange={(e) => setNewStage((c) => ({ ...c, name: e.target.value }))} placeholder="Stage name" className="rounded-xl border border-slate-200 px-3 py-2.5" />
            <input type="color" value={newStage.color} onChange={(e) => setNewStage((c) => ({ ...c, color: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white" />
            <div className="flex gap-2">
              <button onClick={async () => { await api.post('/settings/task-stages', newStage); setCreating(false); setNewStage({ name: '', color: '#6366f1' }); loadStages() }} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white"><Check className="h-4 w-4" /></button>
              <button onClick={() => setCreating(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: stage.color }} />
            <p className="flex-1 text-sm font-medium text-slate-800">{stage.name}</p>
            <button onClick={() => index > 0 && saveAll(stages.map((s, i, arr) => i === index ? arr[index - 1] : i === index - 1 ? arr[index] : s))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><ChevronUp className="h-4 w-4" /></button>
            <button onClick={() => index < stages.length - 1 && saveAll(stages.map((s, i, arr) => i === index ? arr[index + 1] : i === index + 1 ? arr[index] : s))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><ChevronDown className="h-4 w-4" /></button>
            <button onClick={() => {
              const name = prompt('Rename stage', stage.name)
              if (!name) return
              saveAll(stages.map((s) => s.id === stage.id ? { ...s, name } : s))
            }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => stages.length > 1 && saveAll(stages.filter((s) => s.id !== stage.id))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {saving && <p className="text-sm text-slate-500">Saving task stages…</p>}
    </div>
  )
}
