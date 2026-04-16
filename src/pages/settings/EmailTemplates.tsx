import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useOverlay } from '@/hooks/useOverlayManager'

interface EmailTemplate {
  id?: number
  name: string
  subject: string
  body: string
  variables?: string[]
}

const VARIABLES = [
  { label: 'Casting Title', value: '{{casting_title}}' },
  { label: 'Client Name', value: '{{client_name}}' },
  { label: 'Status', value: '{{status}}' },
  { label: 'Shoot Date', value: '{{shoot_date}}' },
  { label: 'Team Members', value: '{{team_members}}' },
]

export function EmailTemplates() {
  const { openOverlay, closeOverlay } = useOverlay()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
  })

  useEffect(() => {
    if (showPreview) {
      openOverlay('email-templates-preview', () => setShowPreview(false))
    } else {
      closeOverlay('email-templates-preview')
    }
  }, [showPreview, openOverlay, closeOverlay])

  const fetchTemplates = async () => {
    try {
      const data = await api.get('/settings/email-templates')
      if (Array.isArray(data)) {
        setTemplates(data)
      } else if (data && Array.isArray(data.templates)) {
        setTemplates(data.templates)
      } else {
        setTemplates([])
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const populatedCount = useMemo(
    () => templates.filter((template) => template.subject.trim() && template.body.trim()).length,
    [templates]
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingTemplate?.id) {
        await api.put(`/settings/email-templates/${editingTemplate.id}`, form)
        setTemplates((prev) => prev.map((t) => t.id === editingTemplate.id ? { ...t, ...form } : t))
      } else {
        const newId = Date.now()
        await api.post('/settings/email-templates', { ...form, id: newId })
        setTemplates((prev) => [...prev, { ...form, id: newId }])
      }
      resetForm()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return
    try {
      await api.del(`/settings/email-templates/${id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setForm({ name: template.name, subject: template.subject, body: template.body })
  }

  const resetForm = () => {
    setIsCreating(false)
    setEditingTemplate(null)
    setForm({ name: '', subject: '', body: '' })
  }

  const insertVariable = (variable: string) => {
    setForm((prev) => ({ ...prev, body: prev.body + variable }))
  }

  const previewTemplate = (template: EmailTemplate) => {
    const previewBody = template.body
      .replace('{{casting_title}}', 'Sample Casting Project')
      .replace('{{client_name}}', 'ABC Company')
      .replace('{{status}}', 'CONFIRMED')
      .replace('{{shoot_date}}', 'April 15, 2026')
      .replace('{{team_members}}', 'John, Sarah, Mike')
    setPreviewData({ ...template, body: previewBody })
    setShowPreview(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">Email templates</h2>
          <p className="text-sm text-slate-500">Build reusable outbound messages for briefs, updates, approvals, and follow-ups.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex shrink-0 items-center gap-1.5 text-xs sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">New template</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Templates</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{templates.length} saved</p>
          <p className="mt-1 text-sm text-slate-500">Keep the library tight enough that the team can pick the right template fast.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ready to send</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{populatedCount} fully written</p>
          <p className="mt-1 text-sm text-slate-500">Templates with both subject and body give the cleanest handoff into automation later.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Writing tip</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Write for reuse, not edge cases.</p>
          <p className="mt-1 text-sm text-slate-600">A small set of strong templates usually beats a cluttered library of one-offs.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
        <p className="mb-2 text-sm font-medium text-slate-600">Available variables</p>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <button
              key={v.value}
              onClick={() => insertVariable(v.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] transition-all hover:border-amber-300 hover:bg-amber-50 sm:text-xs"
              title={`Insert ${v.label}`}
            >
              {v.label} <span className="text-slate-400">{v.value}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {templates.length === 0 && !isCreating && (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email templates</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">No email templates yet</p>
            <p className="mt-2 text-sm text-slate-500">Create the first reusable template to speed up outreach and job communication.</p>
            <p className="mt-2 text-xs text-slate-400">This becomes the reusable messaging layer for briefs, follow-ups, and consistent client communication.</p>
          </div>
        )}
        {templates.map((template) => (
          <motion.div
            key={template.id}
            layout
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 sm:text-[15px]">{template.name}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{template.subject}</p>
              <p className="mt-1 hidden line-clamp-2 text-xs text-slate-400 sm:block">{template.body}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => previewTemplate(template)}
                title="Preview"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit(template)}
                title="Edit"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => template.id && handleDelete(template.id)}
                title="Delete"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {(isCreating || editingTemplate) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 px-4 py-4 sm:px-6 sm:py-5"
        >
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
            {editingTemplate ? 'Edit template' : 'New email template'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="e.g. Casting Confirmation"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="e.g. Casting Confirmation - {{casting_title}}"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="Dear {{client_name}},&#10;&#10;We are pleased to confirm your casting..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.subject.trim()}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save template'}
            </button>
          </div>
        </motion.div>
      )}

      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowPreview(false)} className="absolute inset-0 bg-black/50" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass relative w-full max-w-lg rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="mb-4 font-semibold text-slate-900">Email preview</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">To</p>
                <p className="text-sm">client@example.com</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subject</p>
                <p className="text-sm">{previewData.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Body</p>
                <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">
                  {previewData.body}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="mt-4 w-full btn-primary"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
