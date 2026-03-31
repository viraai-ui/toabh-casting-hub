import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CustomField } from '@/types'

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'file', label: 'File' },
]

const groups = [
  { value: 'contact_info', label: 'Contact Info' },
  { value: 'project_info', label: 'Project Info' },
  { value: 'financials', label: 'Financials' },
  { value: 'custom', label: 'Custom' },
]

export function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('project_info')
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    field_type: 'text' as CustomField['field_type'],
    group: 'project_info' as CustomField['group'],
    options: '',
    required: false,
  })

  const fetchFields = async () => {
    try {
      const data = await api.get('/settings/custom-fields')
      setFields(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFields()
  }, [])

  const groupedFields = fields.filter((f) => f.group === activeGroup)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingField) {
        const updated = fields.map((f) => 
          f.id === editingField.id ? { ...f, ...form } : f
        )
        await api.put('/settings/custom-fields', updated)
        setFields(updated)
      } else {
        const maxId = Math.max(...fields.map((f) => f.id), 0)
        const created = { ...form, id: maxId + 1, required: false }
        await api.post('/settings/custom-fields', [...fields, created])
        setFields([...fields, created])
      }
      resetForm()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this field?')) return
    try {
      await api.put('/settings/custom-fields', fields.filter((f) => f.id !== id))
      setFields((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const resetForm = () => {
    setEditingField(null)
    setIsCreating(false)
    setForm({ name: '', field_type: 'text' as const, group: 'project_info' as const, options: '', required: false })
  }

  const startEdit = (field: CustomField) => {
    setEditingField(field)
    setForm({
      name: field.name,
      field_type: field.field_type,
      group: field.group,
      options: field.options || '',
      required: field.required,
    })
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
          <h2 className="text-xl font-semibold text-slate-900">Custom Fields</h2>
          <p className="text-sm text-slate-500">Add custom fields to your castings</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {/* Group Tabs */}
      <div className="flex gap-2 flex-wrap">
        {groups.map((group) => (
          <button
            key={group.value}
            onClick={() => setActiveGroup(group.value)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeGroup === group.value
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-slate-100 text-slate-600'
            )}
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* Fields List */}
      <div className="space-y-2">
        {groupedFields.length === 0 && !isCreating && (
          <div className="card p-8 text-center">
            <p className="text-slate-500">No fields in this group</p>
          </div>
        )}
        {groupedFields.map((field) => (
          <motion.div
            key={field.id}
            layout
            className="card p-4"
          >
            <div className="flex items-center gap-4">
              <span className="flex-1 font-medium text-slate-900">{field.name}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                field.field_type === 'text' ? 'bg-blue-100 text-blue-700' :
                field.field_type === 'dropdown' ? 'bg-purple-100 text-purple-700' :
                field.field_type === 'date' ? 'bg-green-100 text-green-700' :
                field.field_type === 'number' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-700'
              )}>
                {field.field_type}
              </span>
              {field.options && (
                <span className="text-xs text-slate-400">{field.options.split(',').length} options</span>
              )}
              <button
                onClick={() => startEdit(field)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(field.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingField) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 space-y-4"
        >
          <h3 className="font-semibold text-slate-900">
            {editingField ? 'Edit Field' : 'Add New Field'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                placeholder="Field name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
              <select
                value={form.field_type}
                onChange={(e) => setForm({ ...form, field_type: e.target.value as CustomField['field_type'] })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              >
                {fieldTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Group</label>
              <select
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value as CustomField['group'] })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              >
                {groups.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            {form.field_type === 'dropdown' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Options (comma-separated)</label>
                <input
                  type="text"
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Field'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
