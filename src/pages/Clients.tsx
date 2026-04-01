import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Loader2, Phone, Mail, MessageCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, getInitials } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'
import type { Client, Casting } from '@/types'

export function Clients() {
  const { openOverlay, closeOverlay } = useOverlay()
  const [clients, setClients] = useState<Client[]>([])
  const [castings, setCastings] = useState<Casting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedClient, setExpandedClient] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const fetchClients = async () => {
    try {
      const data = await api.get('/clients')
      setClients(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch clients:', err)
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCastings = async () => {
    try {
      const data = await api.get('/castings')
      setCastings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch castings:', err)
      setCastings([])
    }
  }

  useEffect(() => {
    fetchClients()
    fetchCastings()
  }, [])

  // Register Add/Edit Client modal with overlay manager
  useEffect(() => {
    if (modalOpen) {
      openOverlay('client-modal', () => setModalOpen(false))
    } else {
      closeOverlay('client-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getClientCastings = (clientId: number) => {
    return castings.filter(
      (c) => c.client_name?.toLowerCase() === clients.find((cl) => cl.id === clientId)?.name?.toLowerCase()
    )
  }

  const handleDelete = async (client: Client) => {
    const clientCastings = getClientCastings(client.id)
    if (clientCastings.length > 0) {
      alert('Cannot delete client with castings. Remove all castings first.')
      return
    }
    if (!confirm(`Delete ${client.name}?`)) return
    try {
      await api.del(`/clients/${client.id}`)
      fetchClients()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          />
        </div>
        <button
          onClick={() => {
            setEditingClient(null)
            setModalOpen(true)
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No clients found</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredClients.map((client) => {
            const clientCastings = getClientCastings(client.id)
            const isExpanded = expandedClient === client.id

            // Format phone for WhatsApp: strip non-digits, remove leading 0/91
            const whatsappNumber = client.phone
              ? client.phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '')
              : ''

            return (
              <motion.div
                key={client.id}
                layout
                initial={false}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                {/* ── CARD BODY — fully clickable ───────────────────────── */}
                <div
                  className="flex items-start gap-3 p-3 sm:p-4 cursor-pointer active:bg-slate-50 transition-colors select-none"
                  onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold text-sm sm:text-base shrink-0">
                    {getInitials(client.name)}
                  </div>

                  {/* Info column */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + company badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm sm:text-[15px] truncate max-w-[120px] sm:max-w-[180px]">
                        {client.name}
                      </span>
                      {client.company && (
                        <span className="text-[10px] sm:text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[80px] sm:max-w-[120px]">
                          {client.company}
                        </span>
                      )}
                    </div>

                    {/* Row 2: Email */}
                    {client.email && (
                      <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5 max-w-[200px] sm:max-w-none">
                        {client.email}
                      </p>
                    )}

                    {/* Row 3: Phone */}
                    {client.phone && (
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        {client.phone}
                      </p>
                    )}
                  </div>

                  {/* Action icons — top-right, independent click targets */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClient(client)
                        setModalOpen(true)
                      }}
                      title="Edit client"
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 active:scale-95 transition-all duration-150"
                    >
                      <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(client)
                      }}
                      title="Delete client"
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <div className="w-7 h-8 sm:w-8 flex items-center justify-center text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* ── CTA ROW — Call + WhatsApp ─────────────────────────── */}
                {(client.phone || client.email) && (
                  <div
                    className="flex items-center gap-2 px-3 pb-3 sm:px-4 sm:pb-4 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-[0.97] transition-all text-[11px] sm:text-xs font-medium"
                      >
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>Call</span>
                      </a>
                    )}
                    {client.phone && (
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 active:scale-[0.97] transition-all text-[11px] sm:text-xs font-medium"
                      >
                        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {!client.phone && client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-[0.97] transition-all text-[11px] sm:text-xs font-medium"
                      >
                        <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>Email</span>
                      </a>
                    )}
                    {/* Castings count badge */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 shrink-0">
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-600 leading-none">
                        {clientCastings.length}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── EXPANDED CASTINGS ─────────────────────────────────── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-slate-100"
                    >
                      <div className="px-3 py-3 sm:px-4 sm:py-4 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Castings
                          </span>
                          <span className="text-[10px] sm:text-xs text-slate-400">
                            {clientCastings.length} total
                          </span>
                        </div>
                        {clientCastings.length === 0 ? (
                          <p className="text-xs sm:text-sm text-slate-400 italic">No castings yet</p>
                        ) : (
                          <div className="space-y-1.5 sm:space-y-2">
                            {clientCastings.map((casting) => (
                              <div
                                key={casting.id}
                                className="flex items-center justify-between p-2.5 sm:p-3 bg-white rounded-xl border border-slate-100"
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                                    {casting.project_name || 'Untitled'}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                                    {casting.shoot_date_start ? formatDate(casting.shoot_date_start) : 'No date set'}
                                  </p>
                                </div>
                                <span className={cn(
                                  'shrink-0 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold',
                                  casting.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                  casting.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                                  casting.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                                  'bg-slate-100 text-slate-600'
                                )}>
                                  {casting.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Client Modal */}
      <ClientFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingClient(null)
        }}
        client={editingClient}
        onSave={fetchClients}
      />
    </div>
  )
}

function ClientFormModal({
  open,
  onClose,
  client,
  onSave,
}: {
  open: boolean
  onClose: () => void
  client: Client | null
  onSave: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: '',
  })
  // Track which fields the user has interacted with (for showing inline errors)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // Reset form + touched when modal opens/closes or client changes
  useEffect(() => {
    if (!open) {
      setTouched({})
      return
    }
    if (client) {
      setForm({
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        company: client.company || '',
        notes: client.notes || '',
      })
    } else {
      setForm({ name: '', phone: '', email: '', company: '', notes: '' })
    }
  }, [open, client])

  // Validation helpers
  const validateName = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return 'Name is required'
    return null
  }

  const validatePhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (!value.trim()) return 'Phone number is required'
    if (digits.length < 7) return 'Enter a valid phone number (at least 7 digits)'
    return null
  }

  const validateEmail = (value: string) => {
    if (!value.trim()) return null // optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value.trim())) return 'Enter a valid email address'
    return null
  }

  const nameError = touched.name ? validateName(form.name) : null
  const phoneError = touched.phone ? validatePhone(form.phone) : null
  const emailError = touched.email ? validateEmail(form.email) : null

  const isFormValid =
    !validateName(form.name) &&
    !validatePhone(form.phone) &&
    !validateEmail(form.email)

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const fieldClasses = (error: string | null) =>
    `w-full px-3 py-2 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-colors ${
      error
        ? 'border-red-400 focus:ring-red-400/50'
        : 'border-slate-200'
    }`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Mark all required fields as touched to show any hidden errors
    setTouched({ name: true, phone: true, email: true })
    if (!isFormValid) return

    setSaving(true)
    try {
      if (client) {
        await api.put(`/clients/${client.id}`, form)
      } else {
        await api.post('/clients', form)
      }
      onSave()
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md glass rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
              <h2 className="text-lg font-semibold text-slate-900">
                {client ? 'Edit Client' : 'Add Client'}
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value })
                    if (!touched.name) markTouched('name')
                  }}
                  onBlur={() => markTouched('name')}
                  placeholder="e.g. Priya Kapoor"
                  className={fieldClasses(nameError)}
                />
                {nameError && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <span>⚠</span> {nameError}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value })
                    if (!touched.phone) markTouched('phone')
                  }}
                  onBlur={() => markTouched('phone')}
                  placeholder="e.g. 9876543210"
                  className={fieldClasses(phoneError)}
                />
                {phoneError && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <span>⚠</span> {phoneError}
                  </p>
                )}
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value })
                    if (!touched.email) markTouched('email')
                  }}
                  onBlur={() => markTouched('email')}
                  placeholder="e.g. priya@agency.com"
                  className={fieldClasses(emailError)}
                />
                {emailError && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <span>⚠</span> {emailError}
                  </p>
                )}
              </div>

              {/* Company (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Company <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="e.g. Pulse Media"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Notes (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    'btn-primary',
                    !isFormValid && 'opacity-60 cursor-not-allowed'
                  )}
                  title={!isFormValid ? 'Fill in all required fields to save' : ''}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
