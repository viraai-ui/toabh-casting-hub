import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Loader2,
  AlertCircle,
  Check,
  Paperclip,
  Upload,
  FileText,
  FileImage,
  Presentation,
  FileSpreadsheet,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { Casting, Client, TeamMember, PipelineStage, LeadSource } from '@/types'

interface CastingModalProps {
  open: boolean
  onClose: () => void
  casting: Casting | null
  onSave: () => void
  readOnly?: boolean
}

const TABS = ['Overview', 'Team', 'Budget'] as const
type Tab = typeof TABS[number]

type PendingAttachment = {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
  error?: string
}

type UploadNotice = {
  tone: 'success' | 'error' | 'info'
  message: string
}

const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip,.rar'

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentIconForFile(file: File) {
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()

  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(name)) return FileImage
  if (/\.(ppt|pptx|key)$/.test(name)) return Presentation
  if (/\.(xls|xlsx|csv)$/.test(name)) return FileSpreadsheet
  return FileText
}

function attachmentStatusMeta(status: PendingAttachment['status']) {
  switch (status) {
    case 'uploading':
      return {
        icon: Loader2,
        iconClassName: 'animate-spin text-amber-500',
        badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
        label: 'Uploading',
      }
    case 'uploaded':
      return {
        icon: Check,
        iconClassName: 'text-emerald-600',
        badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        label: 'Uploaded',
      }
    case 'error':
      return {
        icon: AlertCircle,
        iconClassName: 'text-red-500',
        badgeClassName: 'border-red-200 bg-red-50 text-red-600',
        label: 'Error',
      }
    default:
      return {
        icon: Paperclip,
        iconClassName: 'text-slate-400',
        badgeClassName: 'border-slate-200 bg-slate-50 text-slate-500',
        label: 'Ready',
      }
  }
}

export function CastingModal({ open, onClose, casting, onSave, readOnly = false }: CastingModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [customFields, setCustomFields] = useState<any[]>([])
  const [teamError, setTeamError] = useState('')
  const [showClientModal, setShowClientModal] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', company: '' })
  const [creatingClient, setCreatingClient] = useState(false)
  const [queuedAttachments, setQueuedAttachments] = useState<PendingAttachment[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<UploadNotice | null>(null)
  const [draftCastingId, setDraftCastingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setQueuedAttachments([])
      setIsDragActive(false)
      setUploadNotice(null)
      setDraftCastingId(casting?.id ?? null)
      setIsEditing(!readOnly)
      fetchData()
      if (casting) {
        let customFieldsData: { [key: string]: string } = {}
        if (casting.custom_fields) {
          try {
            customFieldsData = JSON.parse(casting.custom_fields)
          } catch {
            customFieldsData = {}
          }
        }
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
      // Defensive: ensure all responses are arrays
      setClients(Array.isArray(clientsData) ? clientsData : [])
      setTeamMembers(Array.isArray(teamData) ? teamData : [])
      setPipeline(Array.isArray(pipelineData) ? pipelineData : [])
      setSources(Array.isArray(sourcesData) ? sourcesData : [])
      setCustomFields(Array.isArray(customFieldsData) ? customFieldsData : [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (name: string) => {
    if (name === '__add_new__') {
      setShowClientModal(true)
      setNewClient({ name: '', phone: '', email: '', company: '' })
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
        company: newClient.company.trim(),
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

  const enqueueFiles = (fileList: FileList | File[]) => {
    const incomingFiles = Array.from(fileList)
    if (!incomingFiles.length) return

    setUploadNotice(null)
    setQueuedAttachments((current) => {
      const existingKeys = new Set(current.map(({ file }) => `${file.name}-${file.size}-${file.lastModified}`))
      const nextItems = incomingFiles
        .filter((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`
          if (existingKeys.has(key)) return false
          existingKeys.add(key)
          return true
        })
        .map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          status: 'pending' as const,
        }))

      if (!nextItems.length) {
        setUploadNotice({ tone: 'info', message: 'Those files are already added.' })
        return current
      }

      return [...current, ...nextItems]
    })
  }

  const handleFileSelection = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      enqueueFiles(e.target.files)
      e.target.value = ''
    }
  }

  const openFilePicker = () => {
    if (saving) return
    fileInputRef.current?.click()
  }

  const handleDragState = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (saving) return
    if (!isDragActive) setIsDragActive(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDragActive(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragActive(false)
    if (saving) return
    if (event.dataTransfer.files?.length) {
      enqueueFiles(event.dataTransfer.files)
    }
  }

  const removeQueuedAttachment = (attachmentId: string) => {
    setQueuedAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
    setUploadNotice(null)
  }

  const uploadQueuedAttachments = async (castingId: number) => {
    if (!queuedAttachments.length) return

    setQueuedAttachments((current) =>
      current.map((attachment) => ({
        ...attachment,
        status: 'uploading' as const,
        error: undefined,
      }))
    )

    const results = await Promise.allSettled(
      queuedAttachments.map(async (attachment) => {
        const formData = new FormData()
        formData.append('file', attachment.file)
        await api.upload(`/castings/${castingId}/attachments`, formData)
        return attachment.id
      })
    )

    const failed = new Map<string, string>()
    const uploadedIds = new Set<string>()

    results.forEach((result, index) => {
      const attachmentId = queuedAttachments[index]?.id
      if (!attachmentId) return

      if (result.status === 'fulfilled') {
        uploadedIds.add(attachmentId)
        return
      }

      failed.set(attachmentId, result.reason instanceof Error ? result.reason.message : 'Upload failed')
    })

    setQueuedAttachments((current) =>
      current
        .map((attachment) => {
          if (uploadedIds.has(attachment.id)) {
            return { ...attachment, status: 'uploaded' as const, error: undefined }
          }
          if (failed.has(attachment.id)) {
            return { ...attachment, status: 'error' as const, error: failed.get(attachment.id) }
          }
          return attachment
        })
        .filter((attachment) => !uploadedIds.has(attachment.id))
    )

    if (failed.size) {
      throw new Error(
        failed.size === queuedAttachments.length
          ? 'Attachments could not be uploaded.'
          : `${failed.size} attachment${failed.size > 1 ? 's' : ''} could not be uploaded.`
      )
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
    setUploadNotice(null)

    try {
      const payload = {
        project_name: form.project_name.trim(),
        client_name: form.client_name.trim(),
        client_company: form.client_company.trim(),
        client_contact: form.client_contact.trim(),
        requirements: form.description.trim(),
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

      let castingId = casting?.id ?? draftCastingId ?? null

      if (castingId) {
        await api.put(`/castings/${castingId}`, payload)
      } else {
        const response = (await api.post('/castings', payload)) as { id?: number }
        castingId = response?.id ?? null
        setDraftCastingId(castingId)
      }

      const queuedAttachmentCount = queuedAttachments.length

      if (castingId && queuedAttachmentCount) {
        await uploadQueuedAttachments(castingId)
      }

      if (queuedAttachmentCount) {
        setUploadNotice({
          tone: 'success',
          message: `Saved casting with ${queuedAttachmentCount} attachment${queuedAttachmentCount > 1 ? 's' : ''}.`,
        })
      }

      onSave()
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
      setUploadNotice({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to save casting.',
      })
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
    <AnimatePresence mode="sync">
      {open && (
        <motion.div
          key="casting-modal"
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
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                {!casting ? 'New Casting' : isEditing ? 'Edit Casting' : 'Casting Details'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 py-1.5 sm:px-6 sm:py-2 border-b border-slate-200 bg-slate-50/50">
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} id="casting-form" noValidate>
                  {/* ======= OVERVIEW TAB ======= */}
                  {activeTab === 'Overview' && (
                    <div className="space-y-3 sm:space-y-4">

                      {/* Project Title — MANDATORY, FIRST */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
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
                            'w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50',
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
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                          Client <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.client_name}
                          onChange={(e) => {
                            handleClientChange(e.target.value)
                            setValidationErrors((v) => ({ ...v, client: undefined }))
                          }}
                          className={cn(
                            'w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 truncate',
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
                        <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-0.5 sm:mb-1">Phone</label>
                            <input
                              type="text"
                              value={form.client_contact}
                              onChange={(e) => setForm({ ...form, client_contact: e.target.value })}
                              className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                              placeholder="Phone"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-0.5 sm:mb-1">Email</label>
                            <input
                              type="email"
                              value={form.client_email}
                              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                              className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 truncate"
                              placeholder="Email"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-0.5 sm:mb-1">Company</label>
                            <input
                              type="text"
                              value={form.client_company}
                              onChange={(e) => setForm({ ...form, client_company: e.target.value })}
                              className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 truncate"
                              placeholder="Company"
                            />
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={3}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                          placeholder="Requirements, notes, reference links..."
                        />
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                            Shoot Date
                          </label>
                          <input
                            type="date"
                            value={form.shoot_date_start}
                            onChange={(e) => setForm({ ...form, shoot_date_start: e.target.value })}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={form.shoot_date_end}
                            onChange={(e) => setForm({ ...form, shoot_date_end: e.target.value })}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={form.location}
                          onChange={(e) => setForm({ ...form, location: e.target.value })}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Location"
                        />
                      </div>

                      {/* Status + Source */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                            Status
                          </label>
                          <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 truncate"
                          >
                            {pipeline.map((stage) => (
                              <option key={stage.id} value={stage.name}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                            Lead Source
                          </label>
                          <select
                            value={form.source}
                            onChange={(e) => setForm({ ...form, source: e.target.value })}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 truncate"
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

                      <div className="border-t border-slate-200 pt-3 sm:pt-4 mt-2">
                        <div className="mb-2 sm:mb-3 flex items-center gap-2 text-[11px] sm:text-xs font-medium uppercase tracking-wide text-slate-400">
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          <span>Attachments</span>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept={ATTACHMENT_ACCEPT}
                          onChange={handleFileSelection}
                          className="sr-only"
                        />

                        <div
                          role="button"
                          tabIndex={saving ? -1 : 0}
                          onClick={openFilePicker}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openFilePicker()
                            }
                          }}
                          onDragEnter={handleDragState}
                          onDragOver={handleDragState}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={cn(
                            'rounded-2xl border border-dashed bg-slate-50/80 px-3 py-4 sm:px-4 sm:py-5 transition-all',
                            saving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                            isDragActive
                              ? 'border-amber-400 bg-amber-50/70 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
                              : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-white text-amber-500 shadow-sm">
                                <Upload className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">Drag and drop files here</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  PDF, images, PPT, Excel, Word, ZIP and other reference files.
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  Files are linked to this casting when you save.
                                </p>
                              </div>
                            </div>
                            <div className="sm:shrink-0">
                              <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-600 shadow-sm transition hover:border-amber-300 hover:bg-amber-50">
                                Browse Files
                              </span>
                            </div>
                          </div>
                        </div>

                        {uploadNotice && (
                          <div
                            className={cn(
                              'mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm',
                              uploadNotice.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                              uploadNotice.tone === 'error' && 'border-red-200 bg-red-50 text-red-600',
                              uploadNotice.tone === 'info' && 'border-slate-200 bg-slate-50 text-slate-600'
                            )}
                          >
                            {uploadNotice.tone === 'success' ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : uploadNotice.tone === 'error' ? (
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <Paperclip className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span>{uploadNotice.message}</span>
                          </div>
                        )}

                        {queuedAttachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {queuedAttachments.map((attachment) => {
                              const AttachmentIcon = attachmentIconForFile(attachment.file)
                              const statusMeta = attachmentStatusMeta(attachment.status)
                              const StatusIcon = statusMeta.icon

                              return (
                                <div
                                  key={attachment.id}
                                  className={cn(
                                    'flex items-start gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition',
                                    attachment.status === 'error'
                                      ? 'border-red-200 bg-red-50/40'
                                      : attachment.status === 'uploading'
                                        ? 'border-amber-200 bg-amber-50/40'
                                        : 'border-slate-200'
                                  )}
                                >
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                    <AttachmentIcon className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate text-sm font-medium text-slate-800">{attachment.file.name}</p>
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                          statusMeta.badgeClassName
                                        )}
                                      >
                                        <StatusIcon className={cn('h-3 w-3', statusMeta.iconClassName)} />
                                        {statusMeta.label}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">{formatFileSize(attachment.file.size)}</p>
                                    {attachment.error && (
                                      <p className="mt-1 text-xs text-red-500">{attachment.error}</p>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeQueuedAttachment(attachment.id)}
                                    disabled={attachment.status === 'uploading'}
                                    className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label={`Remove ${attachment.file.name}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* ======= DYNAMIC CUSTOM FIELDS ======= */}
                      {customFields.length > 0 && (
                        <div className="border-t border-slate-200 pt-3 sm:pt-4 mt-2">
                          <p className="text-[11px] sm:text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 sm:mb-3">
                              Additional Information
                            </p>
                            <div className="space-y-3 sm:space-y-4">
                              {customFields.map((field) => (
                                <div key={field.id}>
                                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
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
                                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
                                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
                                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                    />
                                  )}
                                  {field.type === 'dropdown' && (
                                    <select
                                      value={form.custom_fields?.[field.id] || ''}
                                      onChange={(e) => setForm({
                                        ...form,
                                        custom_fields: { ...form.custom_fields, [field.id]: e.target.value }
                                      })}
                                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 truncate"
                                    >
                                      <option value="">Select...</option>
                                      {(Array.isArray(field.options) ? field.options : (field.options || '').split(',')).map((opt: string, i: number) => (
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
                    <div className="space-y-3 sm:space-y-4">
                      {teamError && (
                        <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs sm:text-sm">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {teamError}
                        </div>
                      )}

                      {/* Assigned members pills */}
                      {form.assigned_to.length > 0 && (
                        <div>
                          <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wide">
                            Assigned ({form.assigned_to.length})
                          </label>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {form.assigned_to.map((memberId) => {
                              const member = teamMembers.find((m) => m.id === memberId)
                              if (!member) return null
                              return (
                                <div
                                  key={memberId}
                                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 rounded-full border border-amber-200"
                                >
                                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] sm:text-xs font-medium">
                                    {getInitials(member.name)}
                                  </div>
                                  <span className="text-xs sm:text-sm text-slate-700 truncate max-w-[100px] sm:max-w-none">{member.name}</span>
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
                                    <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wide">
                          Select Team Members <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          {teamMembers.map((member) => (
                            <label
                              key={member.id}
                              className={cn(
                                'flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border cursor-pointer transition-colors',
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
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs sm:text-sm font-medium shrink-0">
                                {getInitials(member.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 text-xs sm:text-sm truncate">{member.name}</p>
                                <p className="text-[10px] sm:text-xs text-slate-500 truncate">{member.role}</p>
                              </div>
                              {form.assigned_to.includes(member.id) && (
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======= BUDGET TAB — Optional, no validation ======= */}
                  {activeTab === 'Budget' && (
                    <div className="space-y-3 sm:space-y-4">
                      <p className="text-xs sm:text-sm text-slate-500">Budget is optional. Leave blank if not applicable.</p>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                            Budget Min (₹)
                          </label>
                          <input
                            type="number"
                            value={form.budget_min}
                            onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                            Budget Max (₹)
                          </label>
                          <input
                            type="number"
                            value={form.budget_max}
                            onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
            <div className="flex items-center justify-end gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50">
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
                  <div className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">Add New Client</h3>
                    <button
                      onClick={() => setShowClientModal(false)}
                      className="p-1 rounded hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="Client name"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="+91 ..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="client@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Company</label>
                      <input
                        type="text"
                        value={newClient.company}
                        onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                        className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="Company name (optional)"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200 bg-slate-50">
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
