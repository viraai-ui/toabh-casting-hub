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
  const [error, setError] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState('project_info')
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    field_type: 'text' as CustomField['type'],
    group: 'project_info' as any,
    options: '',
    required: false,
  })

  const normalizeTab = (tab: string | undefined): string => {
    if (!tab) return 'custom'
    const t = tab.toLowerCase()
    if (t.includes('contact')) return 'contact_info'
    if (t.includes('project')) return 'project_info'
    if (t.includes('financial')) return 'financials'
    return 'custom'
  }

  const fetchFields = async () => {
    try {
      const data = await api.get('/settings/custom-fields')
      setFields(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Failed to load custom fields')
      setFields([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFields()
  }, [])

  const groupedFields = fields.filter((f) => {
    if (activeGroup === 'all') return true
    return normalizeTab(f.tab) === activeGroup
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build payload with consistent 'type' field
      const tabMap: Record<string, string> = {
        contact_info: 'Contact Info',
        project_info: 'Project Info',
        financials: 'Financials',
      }
      const payload = {
        name: form.name,
        type: form.field_type,
        tab: tabMap[form.group as string] || form.group || 'Custom',
        options: typeof form.options === 'string' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : form.options,
        required: form.required,
      }
      if (editingField) {
        const updated = fields.map((f) =>
          f.id === editingField.id ? { ...f, ...payload } : f
        )
        await api.put('/settings/custom-fields', { fields: updated })
        await fetchFields()
      } else {
        await api.post('/settings/custom-fields', payload)
        await fetchFields()
      }
      resetForm()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!confirm('Delete this field?')) return
    try {
      const updated = fields.filter((f) => f.id !== id)
      await api.put('/settings/custom-fields', { fields: updated })
      setFields(updated)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const resetForm = () => {
    setEditingField(null)
    setIsCreating(false)
    setForm({ name: '', field_type: 'text' as any, group: 'project_info' as any, options: '', required: false })
  }

  const startEdit = (field: CustomField) => {
    setEditingField(field)
    // Normalize tab (API) to group (form)
    const groupKey = normalizeTab(field.tab) as 'custom' | 'contact_info' | 'project_info' | 'financials'
    setForm({
      name: field.name,
      field_type: field.type,
      group: groupKey,
      options: Array.isArray(field.options) ? field.options.join(', ') : (field.options || ''),
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-red-500 mb-2">{error}</p>
        <button onClick={fetchFields} className="btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">Custom Fields</h2>
          <p className="text-xs sm:text-sm text-slate-400">{fields.length} field{fields.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Add Field</span>
          <span className="sm:hidden">Add</span>
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
      <div className="flex flex-col gap-2">
        {groupedFields.length === 0 && !isCreating && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <p className="text-sm text-slate-400">No fields in this group</p>
          </div>
        )}
        {groupedFields.map((field) => (
          <motion.div
            key={field.id}
            layout
            className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-medium text-slate-800 truncate">{field.name}</span>
            <span className={cn(
              'shrink-0 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold',
              field.type === 'text' ? 'bg-blue-100 text-blue-700' :
              field.type === 'dropdown' ? 'bg-purple-100 text-purple-700' :
              field.type === 'date' ? 'bg-emerald-100 text-emerald-700' :
              field.type === 'number' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            )}>
              {field.type}
            </span>
            {field.options && (
              <span className="hidden sm:block shrink-0 text-xs text-slate-400">
                {Array.isArray(field.options) ? field.options.length : String(field.options).split(',').length} opt
              </span>
            )}
            <button
              onClick={() => startEdit(field)}
              title="Edit"
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 active:scale-95 transition-all shrink-0"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(field.id)}
              title="Delete"
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 active:scale-95 transition-all shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingField) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/60 rounded-xl border-2 border-amber-200 p-4 sm:p-6 space-y-4"
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
                onChange={(e) => setForm({ ...form, field_type: e.target.value as CustomField['type'] })}
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
                onChange={(e) => setForm({ ...form, group: e.target.value })}
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
