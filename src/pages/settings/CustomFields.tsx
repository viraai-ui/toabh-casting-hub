import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CustomField } from '@/types'

type CustomFieldType = 'text' | 'dropdown' | 'date' | 'number' | 'file'
type CustomFieldGroup = 'contact_info' | 'project_info' | 'financials' | 'custom'

type SettingsCustomField = CustomField & {
  type: CustomFieldType
  tab?: string
}

const groups = [
  { value: 'contact_info', label: 'Contact Info' },
  { value: 'project_info', label: 'Project Info' },
  { value: 'financials', label: 'Financials' },
  { value: 'custom', label: 'Custom' },
]

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'file', label: 'File' },
]

export function CustomFields() {
  const [fields, setFields] = useState<SettingsCustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState('project_info')
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    field_type: 'text' as CustomFieldType,
    group: 'project_info' as CustomFieldGroup,
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
      setFields(Array.isArray(data) ? data as SettingsCustomField[] : [])
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

  const groupedFields = fields.filter((f) => normalizeTab(f.tab) === activeGroup)
  const requiredCount = useMemo(() => fields.filter((field) => field.required).length, [fields])

  const handleSave = async () => {
    setSaving(true)
    try {
      const tabMap: Record<string, string> = {
        contact_info: 'Contact Info',
        project_info: 'Project Info',
        financials: 'Financials',
      }
      const payload = {
        name: form.name,
        type: form.field_type,
        tab: tabMap[form.group as string] || form.group || 'Custom',
        options: typeof form.options === 'string' ? form.options.split(',').map((o) => o.trim()).filter(Boolean) : form.options,
        required: form.required,
      }
      if (editingField) {
        const updated = fields.map((f) => f.id === editingField.id ? { ...f, ...payload } : f)
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
    setForm({ name: '', field_type: 'text', group: 'project_info', options: '', required: false })
  }

  const startEdit = (field: SettingsCustomField) => {
    setEditingField(field)
    const groupKey = normalizeTab(field.tab) as CustomFieldGroup
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
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="mb-2 text-red-500">{error}</p>
        <button onClick={fetchFields} className="btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">Custom fields</h2>
          <p className="text-sm text-slate-500">Define the structured data your team wants to capture across briefs, contacts, and financials.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex shrink-0 items-center gap-1.5 text-xs sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add field</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fields</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{fields.length} total</p>
          <p className="mt-1 text-sm text-slate-500">Treat this like the schema layer for TOABH intake and operations.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Required</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{requiredCount} required fields</p>
          <p className="mt-1 text-sm text-slate-500">Only mark fields required when they are truly essential to downstream work.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Modeling tip</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Prefer reusable fields over one-off edge-case fields.</p>
          <p className="mt-1 text-sm text-slate-600">Cleaner structure now makes reports, filters, and automations much easier later.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <button
            key={group.value}
            onClick={() => setActiveGroup(group.value)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              activeGroup === group.value
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-slate-100 text-slate-600'
            )}
          >
            {group.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {groupedFields.length === 0 && !isCreating && (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{groups.find((group) => group.value === activeGroup)?.label || 'Custom fields'}</p>
            <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">No fields in this group yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Add the details your team actually needs here so every casting stays consistent from intake to final delivery.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">This becomes the structure layer for capturing the exact information TOABH wants every brief to carry.</p>
          </div>
        )}
        {groupedFields.map((field) => (
          <motion.div
            key={field.id}
            layout
            className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm transition-shadow hover:shadow-md sm:px-4"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 sm:text-[15px]">{field.name}</span>
            <span className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs',
              field.type === 'text' ? 'bg-blue-100 text-blue-700' :
              field.type === 'dropdown' ? 'bg-purple-100 text-purple-700' :
              field.type === 'date' ? 'bg-emerald-100 text-emerald-700' :
              field.type === 'number' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            )}>
              {field.type}
            </span>
            {field.required && (
              <span className="hidden shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 sm:block">Required</span>
            )}
            {field.options && (
              <span className="hidden shrink-0 text-xs text-slate-400 sm:block">
                {Array.isArray(field.options) ? field.options.length : String(field.options).split(',').length} opt
              </span>
            )}
            <button
              onClick={() => startEdit(field)}
              title="Edit"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(field.id)}
              title="Delete"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </div>

      {(isCreating || editingField) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4 sm:p-6"
        >
          <h3 className="font-semibold text-slate-900">
            {editingField ? 'Edit field' : 'Add new field'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Field name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
              <select
                value={form.field_type}
                onChange={(e) => setForm({ ...form, field_type: e.target.value as CustomFieldType })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {fieldTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Group</label>
              <select
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value as CustomFieldGroup })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {groups.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm({ ...form, required: e.target.checked })}
              />
              Required field
            </label>
            {form.field_type === 'dropdown' && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Options (comma-separated)</label>
                <input
                  type="text"
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
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
              {saving ? 'Saving...' : 'Save field'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
