import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Loader2, Phone, Mail } from 'lucide-react'
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
        <div className="card p-12 text-center">
          <p className="text-slate-500">No clients found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const clientCastings = getClientCastings(client.id)
            const isExpanded = expandedClient === client.id

            return (
              <motion.div
                key={client.id}
                layout
                className="card overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold">
                    {getInitials(client.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{client.name}</h3>
                      {client.company && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {client.company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-slate-500">
                      {client.phone && (
                        <a
                          href={'tel:' + client.phone}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-amber-600 transition-colors"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="hidden sm:inline">{client.phone}</span>
                        </a>
                      )}
                      {client.email && (
                        <a
                          href={'mailto:' + client.email}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-amber-600 transition-colors truncate"
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Castings count — full on sm+, badge on mobile */}
                    <div className="hidden xs:flex flex-col items-end mr-1">
                      <span className="text-xs font-semibold text-slate-600">{clientCastings.length}</span>
                      <span className="text-[10px] text-slate-400">castings</span>
                    </div>
                    <span className="xs:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                      {clientCastings.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClient(client)
                        setModalOpen(true)
                      }}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 active:scale-95 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(client)
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 active:scale-95 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Castings</h4>
                        {clientCastings.length === 0 ? (
                          <p className="text-sm text-slate-400">No castings for this client</p>
                        ) : (
                          <div className="space-y-2">
                            {clientCastings.map((casting) => (
                              <div
                                key={casting.id}
                                className="flex items-center justify-between p-3 bg-white rounded-xl"
                              >
                                <div>
                                  <p className="font-medium text-slate-900">{casting.project_name || 'Untitled'}</p>
                                  <p className="text-xs text-slate-500">{formatDate(casting.shoot_date_start)}</p>
                                </div>
                                <span className={cn(
                                  'px-2 py-1 rounded-full text-xs font-medium',
                                  casting.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                  casting.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'
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
