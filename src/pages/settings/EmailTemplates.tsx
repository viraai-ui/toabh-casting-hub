import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, Eye } from 'lucide-react'
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

  // Register email preview modal with overlay manager
  useEffect(() => {
    if (showPreview) {
      openOverlay('email-templates-preview', () => setShowPreview(false))
    } else {
      closeOverlay('email-templates-preview')
    }
  }, [showPreview, openOverlay, closeOverlay])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingTemplate?.id) {
        await api.put(`/settings/email-templates/${editingTemplate.id}`, form)
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...form } : t))
      } else {
        const newId = Date.now()
        await api.post('/settings/email-templates', { ...form, id: newId })
        setTemplates(prev => [...prev, { ...form, id: newId }])
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
      setTemplates(prev => prev.filter(t => t.id !== id))
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
    setForm(prev => ({ ...prev, body: prev.body + variable }))
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
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">Email Templates</h2>
          <p className="text-xs sm:text-sm text-slate-400">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">New Template</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Variables help */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
        <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">Available Variables:</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {VARIABLES.map((v) => (
            <button
              key={v.value}
              onClick={() => insertVariable(v.value)}
              className="px-2 py-1 text-[11px] sm:text-xs bg-white border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 active:scale-95 transition-all"
              title={`Insert ${v.label}`}
            >
              {v.label} <span className="text-slate-400">{v.value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      <div className="flex flex-col gap-2">
        {templates.length === 0 && !isCreating && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <p className="text-sm text-slate-400">No email templates yet</p>
          </div>
        )}
        {templates.map((template) => (
          <motion.div
            key={template.id}
            layout
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm sm:text-[15px] truncate">{template.name}</p>
              <p className="text-xs text-slate-500 sm:hidden truncate">{template.subject}</p>
              <p className="hidden sm:block text-xs text-slate-400 mt-0.5 line-clamp-1">{template.subject}</p>
              <p className="hidden sm:block text-xs text-slate-400 mt-0.5 line-clamp-2">{template.body}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => previewTemplate(template)}
                title="Preview"
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleEdit(template)}
                title="Edit"
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 active:scale-95 transition-all"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => template.id && handleDelete(template.id)}
                title="Delete"
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingTemplate) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/60 rounded-xl border-2 border-amber-200 px-4 py-4 sm:px-6 sm:py-5 space-y-4"
        >
          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
            {editingTemplate ? 'Edit Template' : 'New Email Template'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="e.g. Casting Confirmation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="e.g. Casting Confirmation - {{casting_title}}"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowPreview(false)} className="absolute inset-0 bg-black/50" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-lg glass rounded-2xl shadow-2xl p-6"
          >
            <h3 className="font-semibold text-slate-900 mb-4">Email Preview</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">To:</p>
                <p className="text-sm">client@example.com</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subject:</p>
                <p className="text-sm">{previewData.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Body:</p>
                <div className="p-3 bg-slate-50 rounded-lg text-sm whitespace-pre-wrap">
                  {previewData.body}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="mt-4 btn-primary w-full"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
