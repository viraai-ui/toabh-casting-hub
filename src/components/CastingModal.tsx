import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, MessageCircle, Loader2, AlertCircle, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { Casting, Client, TeamMember, PipelineStage, LeadSource } from '@/types'

interface CastingModalProps {
  open: boolean
  onClose: () => void
  casting: Casting | null
  onSave: () => void
}

const TABS = ['Overview', 'Team', 'Budget'] as const
type Tab = typeof TABS[number]

export function CastingModal({ open, onClose, casting, onSave }: CastingModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [customFields, setCustomFields] = useState<any[]>([])
  const [teamError, setTeamError] = useState('')
  const [showClientModal, setShowClientModal] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' })
  const [creatingClient, setCreatingClient] = useState(false)

  const [form, setForm] = useState({
    project_name: '',
    client_id: '' as number | '',
    client_name: '',
    client_email: '',
    client_company: '',
    client_contact: '',
    description: '',
    shoot_date_start: '',
    shoot_date_end: '',
    location: '',
    status: 'NEW',
    source: '',
    assigned_to: [] as number[],
    budget_min: '',
    budget_max: '',
    custom_fields: {} as { [key: string]: string },
  })

  const [validationErrors, setValidationErrors] = useState<{ project_name?: string; client?: string }>({})

  useEffect(() => {
    if (open) {
      setValidationErrors({})
      setTeamError('')
      setActiveTab('Overview')
      fetchData()
      if (casting) {
        const customFieldsData = casting.custom_fields ? JSON.parse(casting.custom_fields) : {}
        let assignedToIds: number[] = []
        if (casting.assigned_ids) {
          if (typeof casting.assigned_ids === 'string') {
            assignedToIds = casting.assigned_ids.split(',').map(Number).filter(Boolean)
          } else if (Array.isArray(casting.assigned_ids)) {
            assignedToIds = casting.assigned_ids as number[]
          }
        }
        setForm({
          project_name: casting.project_name || '',
          client_id: '',
          client_name: casting.client_name || '',
          client_email: '',
          client_company: casting.client_company || '',
          client_contact: casting.client_contact || '',
          description: casting.requirements || '',
          shoot_date_start: casting.shoot_date_start || '',
          shoot_date_end: casting.shoot_date_end || '',
          location: casting.location || '',
          status: casting.status || 'NEW',
          source: casting.source || '',
          assigned_to: assignedToIds,
          budget_min: casting.budget_min?.toString() || '',
          budget_max: casting.budget_max?.toString() || '',
          custom_fields: customFieldsData,
        })
      } else {
        setForm({
          project_name: '',
          client_id: '',
          client_name: '',
          client_email: '',
          client_company: '',
          client_contact: '',
          description: '',
          shoot_date_start: '',
          shoot_date_end: '',
          location: '',
          status: 'NEW',
          source: '',
          assigned_to: [],
          budget_min: '',
          budget_max: '',
          custom_fields: {},
        })
      }
    }
  }, [open, casting])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [clientsData, teamData, pipelineData, sourcesData, customFieldsData] = await Promise.all([
        api.get('/clients'),
        api.get('/team'),
        api.get('/settings/pipeline'),
        api.get('/settings/sources'),
        api.get('/settings/custom-fields'),
      ])
      setClients(clientsData)
      setTeamMembers(teamData)
      setPipeline(pipelineData)
      setSources(sourcesData)
      setCustomFields(customFieldsData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (name: string) => {
    if (name === '__add_new__') {
      setShowClientModal(true)
      setNewClient({ name: '', phone: '', email: '' })
      return
    }
    const client = clients.find((c) => c.name === name)
    setForm({
      ...form,
      client_id: client?.id || '',
      client_name: name,
      client_email: client?.email || '',
      client_company: client?.company || '',
      client_contact: client?.phone || '',
    })
  }

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) return
    setCreatingClient(true)
    try {
      const created = await api.post('/clients', {
        name: newClient.name.trim(),
        phone: newClient.phone.trim(),
        email: newClient.email.trim(),
        company: '',
      })
      setClients((prev) => [...prev, created])
      setForm({
        ...form,
        client_id: created.id,
        client_name: created.name,
        client_email: created.email || '',
        client_company: created.company || '',
        client_contact: created.phone || '',
      })
      setShowClientModal(false)
    } catch (err) {
      console.error('Failed to create client:', err)
    } finally {
      setCreatingClient(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const errors: typeof validationErrors = {}
    if (!form.project_name.trim()) errors.project_name = 'Project Title is required'
    if (!form.client_name.trim()) errors.client = 'Client is required'
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      setActiveTab('Overview')
      return
    }

    // Team validation
    if (form.assigned_to.length === 0) {
      setTeamError('At least one team member is required')
      setActiveTab('Team')
      return
    }

    setSaving(true)
    try {
      const payload = {
        project_name: form.project_name.trim(),
        client_name: form.client_name.trim(),
        client_company: form.client_company.trim(),
        client_contact: form.client_contact.trim(),
        description: form.description.trim(),
        shoot_date_start: form.shoot_date_start,
        shoot_date_end: form.shoot_date_end,
        location: form.location.trim(),
        status: form.status,
        source: form.source,
        assigned_to: form.assigned_to,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        custom_fields: JSON.stringify(form.custom_fields),
      }
      if (casting) {
        await api.put(`/castings/${casting.id}`, payload)
      } else {
        await api.post('/castings', payload)
      }
      onSave()
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-900">
                {casting ? 'Edit Casting' : 'New Casting'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 py-2 border-b border-slate-200 bg-slate-50/50">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab
                      ? 'bg-white text-amber-600 shadow-sm'
                      : 'text-slate-600 hover:bg-white/50'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} id="casting-form" noValidate>
                  {/* ======= OVERVIEW TAB ======= */}
                  {activeTab === 'Overview' && (
                    <div className="space-y-4">

                      {/* Project Title — MANDATORY, FIRST */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Project Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.project_name}
                          onChange={(e) => {
                            setForm({ ...form, project_name: e.target.value })
                            if (e.target.value.trim()) {
                              setValidationErrors((v) => ({ ...v, project_name: undefined }))
                            }
                          }}
                          className={cn(
                            'w-full px-3 py-2 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                            validationErrors.project_name ? 'border-red-400 bg-red-50/30' : 'border-slate-200'
                          )}
                          placeholder="Project name"
                        />
                        {validationErrors.project_name && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.project_name}
                          </p>
                        )}
                      </div>

                      {/* Client — MANDATORY, SECOND */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Client <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.client_name}
                          onChange={(e) => {
                            handleClientChange(e.target.value)
                            setValidationErrors((v) => ({ ...v, client: undefined }))
                          }}
                          className={cn(
                            'w-full px-3 py-2 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                            validationErrors.client ? 'border-red-400 bg-red-50/30' : 'border-slate-200'
                          )}
                        >
                          <option value="">Select client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.name}>
                              {client.name}
                            </option>
                          ))}
                          <option value="__add_new__" className="text-amber-600 font-medium">
                            + Add New Client
                          </option>
                        </select>
                        {validationErrors.client && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.client}
                          </p>
                        )}
                      </div>

                      {/* Client Details — auto-populated */}
                      {form.client_name && form.client_name !== '__add_new__' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                            <input
                              type="text"
                              value={form.client_contact}
                              onChange={(e) => setForm({ ...form, client_contact: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                              placeholder="Phone"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                            <input
                              type="email"
                              value={form.client_email}
                              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                              placeholder="Email"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Company</label>
                            <input
                              type="text"
                              value={form.client_company}
                              onChange={(e) => setForm({ ...form, client_company: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                              placeholder="Company"
                            />
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Description <span className="text-slate-400 font-normal">(Notes merged here)</span>
                        </label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Requirements, notes, reference links..."
                        />
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Shoot Date
                          </label>
                          <input
                            type="date"
                            value={form.shoot_date_start}
                            onChange={(e) => setForm({ ...form, shoot_date_start: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={form.shoot_date_end}
                            onChange={(e) => setForm({ ...form, shoot_date_end: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Location
                        </label>
                        <input
                          type="text"
                          value={form.location}
                          onChange={(e) => setForm({ ...form, location: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Location"
                        />
                      </div>

                      {/* Status + Source */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Status
                          </label>
                          <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          >
                            {pipeline.map((stage) => (
                              <option key={stage.id} value={stage.name}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Lead Source
                          </label>
                          <select
                            value={form.source}
                            onChange={(e) => setForm({ ...form, source: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          >
                            <option value="">Select source</option>
                            {sources.map((source) => (
                              <option key={source.id} value={source.name}>
                                {source.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Call / WhatsApp quick links */}
                      {form.client_contact && (
                        <div className="flex gap-2">
                          <a
                            href={`tel:${form.client_contact.startsWith('+') ? form.client_contact : '+91' + form.client_contact}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-slate-700 hover:bg-slate-200 transition-colors text-sm"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </a>
                          <a
                            href={`https://wa.me/${form.client_contact.replace(/\D/g, '')}?text=Regarding ${form.project_name || 'your casting'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-xl text-green-700 hover:bg-green-200 transition-colors text-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </a>
                        </div>
                      )}

                      {/* ======= DYNAMIC CUSTOM FIELDS ======= */}
                      {customFields.length > 0 && (
                        <div className="border-t border-slate-200 pt-4 mt-2">
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                            Additional Information
                          </p>
                          <div className="space-y-4">
                            {customFields.map((field) => (
                              <div key={field.id}>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                  {field.name}
                                </label>
                                {field.type === 'text' && (
                                  <input
                                    type="text"
                                    value={form.custom_fields?.[field.id] || ''}
                                    onChange={(e) => setForm({
                                      ...form,
                                      custom_fields: { ...form.custom_fields, [field.id]: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                    placeholder={`Enter ${field.name.toLowerCase()}`}
                                  />
                                )}
                                {field.type === 'number' && (
                                  <input
                                    type="number"
                                    value={form.custom_fields?.[field.id] || ''}
                                    onChange={(e) => setForm({
                                      ...form,
                                      custom_fields: { ...form.custom_fields, [field.id]: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                    placeholder={`Enter ${field.name.toLowerCase()}`}
                                  />
                                )}
                                {field.type === 'date' && (
                                  <input
                                    type="date"
                                    value={form.custom_fields?.[field.id] || ''}
                                    onChange={(e) => setForm({
                                      ...form,
                                      custom_fields: { ...form.custom_fields, [field.id]: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                  />
                                )}
                                {field.type === 'dropdown' && (
                                  <select
                                    value={form.custom_fields?.[field.id] || ''}
                                    onChange={(e) => setForm({
                                      ...form,
                                      custom_fields: { ...form.custom_fields, [field.id]: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                  >
                                    <option value="">Select...</option>
                                    {(field.options || '').split(',').map((opt: string, i: number) => (
                                      <option key={i} value={opt.trim()}>{opt.trim()}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======= TEAM TAB ======= */}
                  {activeTab === 'Team' && (
                    <div className="space-y-4">
                      {teamError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {teamError}
                        </div>
                      )}

                      {/* Assigned members pills */}
                      {form.assigned_to.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                            Assigned ({form.assigned_to.length})
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {form.assigned_to.map((memberId) => {
                              const member = teamMembers.find((m) => m.id === memberId)
                              if (!member) return null
                              return (
                                <div
                                  key={memberId}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200"
                                >
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-medium">
                                    {getInitials(member.name)}
                                  </div>
                                  <span className="text-sm text-slate-700">{member.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForm({
                                        ...form,
                                        assigned_to: form.assigned_to.filter((id) => id !== memberId),
                                      })
                                      setTeamError('')
                                    }}
                                    className="p-0.5 rounded-full hover:bg-amber-200 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5 text-slate-500" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                          Select Team Members <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {teamMembers.map((member) => (
                            <label
                              key={member.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                                form.assigned_to.includes(member.id)
                                  ? 'border-amber-500 bg-amber-500/5'
                                  : 'border-slate-200 hover:bg-slate-50'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={form.assigned_to.includes(member.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setForm({
                                      ...form,
                                      assigned_to: [...form.assigned_to, member.id],
                                    })
                                    setTeamError('')
                                  } else {
                                    setForm({
                                      ...form,
                                      assigned_to: form.assigned_to.filter((id) => id !== member.id),
                                    })
                                  }
                                }}
                                className="sr-only"
                              />
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                                {getInitials(member.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 text-sm truncate">{member.name}</p>
                                <p className="text-xs text-slate-500 truncate">{member.role}</p>
                              </div>
                              {form.assigned_to.includes(member.id) && (
                                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======= BUDGET TAB — Optional, no validation ======= */}
                  {activeTab === 'Budget' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Budget is optional. Leave blank if not applicable.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Budget Min (₹)
                          </label>
                          <input
                            type="number"
                            value={form.budget_min}
                            onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Budget Max (₹)
                          </label>
                          <input
                            type="number"
                            value={form.budget_max}
                            onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="casting-form"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Casting'}
              </button>
            </div>
          </motion.div>

          {/* ======= INLINE CLIENT CREATION MODAL ======= */}
          <AnimatePresence>
            {showClientModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 text-sm">Add New Client</h3>
                    <button
                      onClick={() => setShowClientModal(false)}
                      className="p-1 rounded hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="Client name"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="+91 ..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="client@email.com"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setShowClientModal(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={creatingClient || !newClient.name.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {creatingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {creatingClient ? 'Creating...' : 'Create & Select'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
