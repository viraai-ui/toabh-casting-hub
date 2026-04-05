import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BriefcaseBusiness, CheckSquare, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CustomField } from '@/types'

type FieldCategory = 'jobs' | 'clients' | 'tasks'
type FieldGroup = 'contact_info' | 'project_info' | 'financials' | 'workflow' | 'scheduling' | 'custom'

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'file', label: 'File' },
] as const

const categoryMeta: Array<{
  value: FieldCategory
  label: string
  description: string
  icon: typeof Users
}> = [
  { value: 'clients', label: 'Clients', description: 'Contact, relationship, and account fields', icon: Users },
  { value: 'jobs', label: 'Jobs', description: 'Project, budget, and delivery details', icon: BriefcaseBusiness },
  { value: 'tasks', label: 'Tasks', description: 'Workflow, due date, and execution details', icon: CheckSquare },
]

const groupsByCategory: Record<FieldCategory, Array<{ value: FieldGroup; label: string }>> = {
  clients: [
    { value: 'contact_info', label: 'Contact Info' },
    { value: 'financials', label: 'Financials' },
    { value: 'custom', label: 'Custom' },
  ],
  jobs: [
    { value: 'project_info', label: 'Project Info' },
    { value: 'financials', label: 'Financials' },
    { value: 'custom', label: 'Custom' },
  ],
  tasks: [
    { value: 'workflow', label: 'Workflow' },
    { value: 'scheduling', label: 'Scheduling' },
    { value: 'custom', label: 'Custom' },
  ],
}

const tabMap: Record<FieldGroup, string> = {
  contact_info: 'Contact Info',
  project_info: 'Project Info',
  financials: 'Financials',
  workflow: 'Workflow',
  scheduling: 'Scheduling',
  custom: 'Custom',
}

const defaultGroupByCategory: Record<FieldCategory, FieldGroup> = {
  clients: 'contact_info',
  jobs: 'project_info',
  tasks: 'workflow',
}

const emptyForm = (category: FieldCategory) => ({
  name: '',
  field_type: 'text' as CustomField['type'],
  category,
  group: defaultGroupByCategory[category],
  options: '',
  required: false,
})

function normalizeTab(tab: string | undefined, entity: FieldCategory): FieldGroup {
  const value = (tab || '').toLowerCase()

  if (value.includes('contact')) return 'contact_info'
  if (value.includes('project')) return 'project_info'
  if (value.includes('financial')) return 'financials'
  if (value.includes('workflow') || value.includes('status') || value.includes('stage')) return 'workflow'
  if (value.includes('schedul') || value.includes('timeline') || value.includes('due')) return 'scheduling'

  return defaultGroupByCategory[entity] === 'workflow' ? 'custom' : 'custom'
}

export function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<FieldCategory>('clients')
  const [activeGroup, setActiveGroup] = useState<FieldGroup>(defaultGroupByCategory.clients)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm('clients'))

  const fetchFields = async () => {
    try {
      const data = await api.get('/settings/custom-fields')
      setFields(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch custom fields:', err)
      setError('Failed to load custom fields')
      setFields([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFields()
  }, [])

  useEffect(() => {
    const nextDefaultGroup = defaultGroupByCategory[activeCategory]
    setActiveGroup(nextDefaultGroup)

    if (!editingField) {
      setForm((current) => ({
        ...current,
        category: activeCategory,
        group: groupsByCategory[activeCategory].some((group) => group.value === current.group)
          ? current.group
          : nextDefaultGroup,
      }))
    }
  }, [activeCategory, editingField])

  const visibleGroups = groupsByCategory[activeCategory]

  const categoryCounts = useMemo(
    () =>
      categoryMeta.reduce(
        (acc, category) => {
          acc[category.value] = fields.filter((field) => (field.entity || 'jobs') === category.value).length
          return acc
        },
        {} as Record<FieldCategory, number>,
      ),
    [fields],
  )

  const groupedFields = useMemo(
    () =>
      fields.filter((field) => {
        const entity = (field.entity || 'jobs') as FieldCategory
        if (entity !== activeCategory) return false
        return normalizeTab(field.tab, entity) === activeGroup
      }),
    [activeCategory, activeGroup, fields],
  )

  const resetForm = () => {
    setEditingField(null)
    setIsCreating(false)
    setForm(emptyForm(activeCategory))
  }

  const openCreate = () => {
    setEditingField(null)
    setIsCreating(true)
    setForm(emptyForm(activeCategory))
  }

  const startEdit = (field: CustomField) => {
    const category = (field.entity || 'jobs') as FieldCategory
    const normalizedGroup = normalizeTab(field.tab, category)

    setActiveCategory(category)
    setActiveGroup(normalizedGroup)
    setEditingField(field)
    setIsCreating(false)
    setForm({
      name: field.name,
      field_type: field.type,
      category,
      group: normalizedGroup,
      options: Array.isArray(field.options) ? field.options.join(', ') : field.options || '',
      required: field.required,
    })
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const payload = {
        name: form.name.trim(),
        type: form.field_type,
        entity: form.category,
        tab: tabMap[form.group],
        options:
          form.field_type === 'dropdown'
            ? form.options
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean)
            : [],
        required: form.required,
      }

      if (editingField) {
        const updated = fields.map((field) => (field.id === editingField.id ? { ...field, ...payload } : field))
        await api.put('/settings/custom-fields', { fields: updated })
        setFields(updated)
      } else {
        const maxId = Math.max(...fields.map((field) => Number(field.id) || 0), 0)
        const created = { ...payload, id: String(maxId + 1) }
        await api.post('/settings/custom-fields', created)
        setFields((current) => [...current, created as CustomField])
      }

      resetForm()
    } catch (err) {
      console.error('Failed to save custom field:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!confirm('Delete this field?')) return

    try {
      const updated = fields.filter((field) => field.id !== id)
      await api.put('/settings/custom-fields', { fields: updated })
      setFields(updated)
    } catch (err) {
      console.error('Failed to delete custom field:', err)
    }
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Custom Fields</h2>
          <p className="text-sm text-slate-500">Create flexible fields for clients, jobs, and tasks.</p>
        </div>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 self-start lg:self-auto">
          <Plus className="h-4 w-4" />
          Add Field
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {categoryMeta.map((category) => {
          const Icon = category.icon
          const active = activeCategory === category.value

          return (
            <button
              key={category.value}
              onClick={() => setActiveCategory(category.value)}
              className={cn(
                'rounded-3xl border px-4 py-4 text-left transition-all',
                active
                  ? 'border-amber-200 bg-amber-50 shadow-sm ring-1 ring-amber-100'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', active ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                  {categoryCounts[category.value] || 0}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">{category.label}</p>
              <p className="mt-1 text-sm text-slate-500">{category.description}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-2">
          {visibleGroups.map((group) => (
            <button
              key={group.value}
              onClick={() => setActiveGroup(group.value)}
              className={cn(
                'rounded-2xl px-4 py-2 text-sm font-medium transition-colors',
                activeGroup === group.value
                  ? 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {groupedFields.length === 0 && !isCreating && !editingField && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">No {activeCategory} fields in {visibleGroups.find((group) => group.value === activeGroup)?.label?.toLowerCase()} yet.</p>
              <p className="mt-1 text-sm text-slate-500">Add one to keep this category tailored to your workflow.</p>
            </div>
          )}

          {groupedFields.map((field) => (
            <motion.div
              key={field.id}
              layout
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{field.name}</p>
                  {field.required && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{tabMap[normalizeTab(field.tab, (field.entity || 'jobs') as FieldCategory)]} • {(field.entity || 'jobs').charAt(0).toUpperCase() + (field.entity || 'jobs').slice(1)}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                  field.type === 'text'
                    ? 'bg-blue-50 text-blue-700'
                    : field.type === 'dropdown'
                      ? 'bg-purple-50 text-purple-700'
                      : field.type === 'date'
                        ? 'bg-emerald-50 text-emerald-700'
                        : field.type === 'number'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600',
                )}
              >
                {field.type}
              </span>
              <button
                onClick={() => startEdit(field)}
                title="Edit field"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(field.id)}
                title="Delete field"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {(isCreating || editingField) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-amber-200 bg-amber-50/70 p-5 shadow-sm"
        >
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">{editingField ? 'Edit Field' : 'Add New Field'}</h3>
            <p className="mt-1 text-sm text-slate-500">Fields can be scoped to clients, jobs, or tasks and organized by category-specific sections.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Field name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Field Type</label>
              <select
                value={form.field_type}
                onChange={(event) => setForm((current) => ({ ...current, field_type: event.target.value as CustomField['type'] }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {fieldTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(event) => {
                  const category = event.target.value as FieldCategory
                  setActiveCategory(category)
                  setForm((current) => ({
                    ...current,
                    category,
                    group: groupsByCategory[category][0].value,
                  }))
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {categoryMeta.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Group</label>
              <select
                value={form.group}
                onChange={(event) => setForm((current) => ({ ...current, group: event.target.value as FieldGroup }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {groupsByCategory[form.category].map((group) => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </div>

            {form.field_type === 'dropdown' && (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Options</label>
                <input
                  type="text"
                  value={form.options}
                  onChange={(event) => setForm((current) => ({ ...current, options: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}

            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">Required field</span>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? 'Saving...' : editingField ? 'Save Changes' : 'Save Field'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
