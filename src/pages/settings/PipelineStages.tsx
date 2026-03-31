import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { PipelineStage } from '@/types'

export function PipelineStages() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newStage, setNewStage] = useState({ name: '', color: '#f59e0b' })
  const [addingNew, setAddingNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchStages = async () => {
    try {
      const data = await api.get('/settings/pipeline')
      setStages(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStages()
  }, [])

  const handleSave = async (stage: PipelineStage) => {
    setSaving(true)
    try {
      await api.put('/settings/pipeline', stages.map((s) => 
        s.id === stage.id ? stage : s
      ))
      setStages((prev) => prev.map((s) => s.id === stage.id ? stage : s))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this stage?')) return
    try {
      await api.put('/settings/pipeline', stages.filter((s) => s.id !== id))
      setStages((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleAdd = async () => {
    if (!newStage.name.trim()) return
    setSaving(true)
    try {
      const maxId = Math.max(...stages.map((s) => s.id), 0)
      const created = { ...newStage, id: maxId + 1, order: stages.length }
      await api.post('/settings/pipeline', [...stages, created])
      setStages([...stages, created])
      setNewStage({ name: '', color: '#f59e0b' })
      setAddingNew(false)
    } catch (err) {
      console.error('Failed to add:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleMove = async (id: number, direction: 'up' | 'down') => {
    const idx = stages.findIndex((s) => s.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === stages.length - 1) return
    
    const newStages = [...stages]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newStages[idx], newStages[swapIdx]] = [newStages[swapIdx], newStages[idx]]
    
    try {
      await api.put('/settings/pipeline', newStages)
      setStages(newStages)
    } catch (err) {
      console.error('Failed to reorder:', err)
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pipeline Stages</h2>
          <p className="text-sm text-slate-500">Manage your casting pipeline stages</p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Stage
        </button>
      </div>

      {/* Stages List */}
      <div className="space-y-2">
        {stages.map((stage, index) => (
          <motion.div
            key={stage.id}
            layout
            className="card p-4"
          >
            {editingId === stage.id ? (
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, color: e.target.value } : s))}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={stage.name}
                  onChange={(e) => setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, name: e.target.value } : s))}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl"
                  autoFocus
                />
                <button onClick={() => handleSave(stage)} disabled={saving} className="btn-primary text-sm">
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMove(stage.id, 'up')}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(stage.id, 'down')}
                    disabled={index === stages.length - 1}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="flex-1 font-medium text-slate-900">{stage.name}</span>
                <button
                  onClick={() => setEditingId(stage.id)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(stage.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Add New Form */}
      {addingNew && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4"
        >
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={newStage.color}
              onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={newStage.name}
              onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
              placeholder="Stage name"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl"
              autoFocus
            />
            <button onClick={handleAdd} disabled={saving || !newStage.name.trim()} className="btn-primary text-sm">
              {saving ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => { setAddingNew(false); setNewStage({ name: '', color: '#f59e0b' }) }} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
