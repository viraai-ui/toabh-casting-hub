import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Pencil,
  Trash2,
  Tag,
  Briefcase,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, getInitials } from '@/lib/utils'
import { useOverlay } from '@/hooks/useOverlayManager'
import type { Casting, Client, ClientTag } from '@/types'
import { ClientTagPill, getClientTagStyles } from '@/components/clients/ClientTagPill'

interface ClientTagWithUsage extends ClientTag {
  usage_count?: number
}

export function Clients() {
  const { openOverlay, closeOverlay } = useOverlay()
  const [clients, setClients] = useState<Client[]>([])
  const [castings, setCastings] = useState<Casting[]>([])
  const [availableTags, setAvailableTags] = useState<ClientTagWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>([])
  const [expandedClient, setExpandedClient] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [quickAddClientId, setQuickAddClientId] = useState<number | null>(null)
  const [savingTagClientId, setSavingTagClientId] = useState<number | null>(null)

  const fetchPageData = async () => {
    try {
      const [clientsData, castingsData, tagsData] = await Promise.all([
        api.get('/clients'),
        api.get('/castings'),
        api.get('/settings/client-tags'),
      ])
      setClients(Array.isArray(clientsData) ? clientsData : [])
      setCastings(Array.isArray(castingsData) ? castingsData : [])
      setAvailableTags(Array.isArray(tagsData) ? tagsData : [])
    } catch (err) {
      console.error('Failed to load clients page:', err)
      setClients([])
      setCastings([])
      setAvailableTags([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPageData()
  }, [])

  useEffect(() => {
    if (modalOpen) {
      openOverlay('client-modal', () => setModalOpen(false))
    } else {
      closeOverlay('client-modal')
    }
  }, [modalOpen, openOverlay, closeOverlay])

  const getClientCastings = (clientId: number) => {
    const clientName = clients.find((client) => client.id === clientId)?.name?.toLowerCase()
    return castings.filter((casting) => casting.client_name?.toLowerCase() === clientName)
  }

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return clients.filter((client) => {
      const matchesQuery =
        !query ||
        client.name.toLowerCase().includes(query) ||
        client.company?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query) ||
        (client.tags ?? []).some((tag) => tag.name.toLowerCase().includes(query))

      const matchesTagFilter =
        selectedFilterTagIds.length === 0 ||
        selectedFilterTagIds.every((tagId) => (client.tags ?? []).some((tag) => tag.id === tagId))

      return matchesQuery && matchesTagFilter
    })
  }, [clients, searchQuery, selectedFilterTagIds])

  const taggedClientsCount = useMemo(
    () => clients.filter((client) => (client.tags ?? []).length > 0).length,
    [clients],
  )

  const totalClientTagAssignments = useMemo(
    () => clients.reduce((sum, client) => sum + (client.tags?.length ?? 0), 0),
    [clients],
  )

  const updateClientFromResponse = (updatedClient: Client) => {
    setClients((prev) => prev.map((client) => (client.id === updatedClient.id ? updatedClient : client)))
  }

  const handleDelete = async (client: Client) => {
    const clientCastings = getClientCastings(client.id)
    if (clientCastings.length > 0) {
      window.alert('Cannot delete client with castings. Remove all castings first.')
      return
    }
    if (!window.confirm(`Delete ${client.name}?`)) return
    try {
      await api.del(`/clients/${client.id}`)
      setClients((prev) => prev.filter((item) => item.id !== client.id))
    } catch (err) {
      console.error('Failed to delete client:', err)
    }
  }

  const addTagToClient = async (clientId: number, tagId: number) => {
    setSavingTagClientId(clientId)
    try {
      const updated = await api.post(`/clients/${clientId}/tags`, { tag_id: tagId })
      updateClientFromResponse(updated as Client)
      setQuickAddClientId(null)
    } catch (err) {
      console.error('Failed to add tag to client:', err)
    } finally {
      setSavingTagClientId(null)
    }
  }

  const removeTagFromClient = async (clientId: number, tagId: number) => {
    setSavingTagClientId(clientId)
    try {
      const updated = await api.del(`/clients/${clientId}/tags/${tagId}`)
      updateClientFromResponse(updated as Client)
    } catch (err) {
      console.error('Failed to remove tag from client:', err)
    } finally {
      setSavingTagClientId(null)
    }
  }

  const toggleFilterTag = (tagId: number) => {
    setSelectedFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-amber-50/70 to-orange-50 px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              <Users className="h-3.5 w-3.5" />
              Client CRM
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-[30px]">Clients with smart tags, faster scanning, cleaner layout</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-[15px]">
              Search faster, group by custom tags, and update client labels directly from the list without losing the current casting workflow.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <StatCard icon={Users} label="Total Clients" value={clients.length} />
            <StatCard icon={Tag} label="Tagged Clients" value={taggedClientsCount} />
            <StatCard icon={Briefcase} label="Live Castings" value={castings.length} />
            <StatCard icon={Tag} label="Tag Links" value={totalClientTagAssignments} />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search clients, company, phone, email, or tags..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <button
            onClick={() => {
              setEditingClient(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </button>
        </div>

        {availableTags.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Filter Tags</span>
              {availableTags.map((tag) => {
                const isSelected = selectedFilterTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleFilterTag(tag.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500/20',
                      isSelected ? 'shadow-sm ring-1 ring-offset-1 ring-offset-white' : 'opacity-75 hover:opacity-100',
                    )}
                    style={getClientTagStyles(tag.color)}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {selectedFilterTagIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFilterTagIds([])}
                  className="rounded-full border border-transparent px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">No clients found</p>
          <p className="mt-1 text-sm text-slate-500">Try changing the search or tag filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const clientCastings = getClientCastings(client.id)
            const isExpanded = expandedClient === client.id
            const clientTags = client.tags ?? []
            const availableQuickAddTags = availableTags.filter(
              (tag) => !clientTags.some((clientTag) => clientTag.id === tag.id),
            )
            const whatsappNumber = client.phone
              ? client.phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '')
              : ''

            return (
              <motion.div
                key={client.id}
                layout
                initial={false}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className="cursor-pointer p-4 sm:p-5"
                  onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-semibold text-white shadow-sm sm:h-14 sm:w-14 sm:text-base">
                      {getInitials(client.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{client.name}</h3>
                        {client.company && (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 sm:text-xs">
                            {client.company}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1 sm:text-sm">
                        {client.email && <span className="truncate">{client.email}</span>}
                        {client.phone && <span>{client.phone}</span>}
                        <span>{clientCastings.length} casting{clientCastings.length === 1 ? '' : 's'}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        {clientTags.map((tag) => (
                          <ClientTagPill
                            key={tag.id}
                            tag={tag}
                            onRemove={() => removeTagFromClient(client.id, tag.id)}
                          />
                        ))}

                        {availableTags.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setQuickAddClientId((prev) => (prev === client.id ? null : client.id))}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tag
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {quickAddClientId === client.id && availableQuickAddTags.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick add tags</p>
                            <div className="flex flex-wrap gap-2">
                              {availableQuickAddTags.map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => addTagToClient(client.id, tag.id)}
                                  disabled={savingTagClientId === client.id}
                                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-100 disabled:opacity-50"
                                  style={getClientTagStyles(tag.color)}
                                >
                                  {tag.name}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditingClient(client)
                          setModalOpen(true)
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                        title="Edit client"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDelete(client)
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        title="Delete client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="flex h-10 w-10 items-center justify-center text-slate-400">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {(client.phone || client.email) && (
                    <div className="mt-4 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 sm:text-sm"
                        >
                          <Phone className="h-4 w-4" />
                          Call
                        </a>
                      )}
                      {client.phone && (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-600 transition hover:bg-green-100 sm:text-sm"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      )}
                      {!client.phone && client.email && (
                        <a
                          href={`mailto:${client.email}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 sm:text-sm"
                        >
                          <Mail className="h-4 w-4" />
                          Email
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-slate-100"
                    >
                      <div className="grid gap-4 bg-slate-50/80 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Castings</span>
                            <span className="text-xs text-slate-400">{clientCastings.length} total</span>
                          </div>

                          {clientCastings.length === 0 ? (
                            <p className="mt-3 text-sm italic text-slate-400">No castings yet</p>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {clientCastings.map((casting) => (
                                <div
                                  key={casting.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-800">
                                      {casting.project_name || 'Untitled'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {casting.shoot_date_start ? formatDate(casting.shoot_date_start) : 'No date set'}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                      casting.status === 'COMPLETED'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : casting.status === 'IN_PROGRESS'
                                          ? 'bg-amber-100 text-amber-700'
                                          : casting.status === 'NEW'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-slate-100 text-slate-600',
                                    )}
                                  >
                                    {casting.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Notes</span>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {client.notes?.trim() || 'No internal notes added yet.'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      <ClientFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingClient(null)
        }}
        client={editingClient}
        availableTags={availableTags}
        onSave={(savedClient) => {
          if (editingClient) {
            updateClientFromResponse(savedClient)
          } else {
            setClients((prev) => [savedClient, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
          }
        }}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function ClientFormModal({
  open,
  onClose,
  client,
  availableTags,
  onSave,
}: {
  open: boolean
  onClose: () => void
  client: Client | null
  availableTags: ClientTag[]
  onSave: (client: Client) => void
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: '',
    tag_ids: [] as number[],
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

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
        tag_ids: (client.tags ?? []).map((tag) => tag.id),
      })
    } else {
      setForm({
        name: '',
        phone: '',
        email: '',
        company: '',
        notes: '',
        tag_ids: [],
      })
    }
  }, [open, client])

  const validateName = (value: string) => {
    if (!value.trim()) return 'Name is required'
    return null
  }

  const validatePhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (!value.trim()) return 'Phone number is required'
    if (digits.length < 7) return 'Enter a valid phone number (at least 7 digits)'
    return null
  }

  const validateEmail = (value: string) => {
    if (!value.trim()) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value.trim())) return 'Enter a valid email address'
    return null
  }

  const nameError = touched.name ? validateName(form.name) : null
  const phoneError = touched.phone ? validatePhone(form.phone) : null
  const emailError = touched.email ? validateEmail(form.email) : null

  const isFormValid = !validateName(form.name) && !validatePhone(form.phone) && !validateEmail(form.email)

  const fieldClasses = (error: string | null) =>
    `w-full rounded-2xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
      error ? 'border-red-400 focus:ring-red-400/30' : 'border-slate-200 focus:border-amber-400 focus:ring-amber-500/20'
    }`

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const toggleTagSelection = (tagId: number) => {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ name: true, phone: true, email: true })
    if (!isFormValid) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        notes: form.notes,
        tag_ids: form.tag_ids,
      }

      const savedClient = client
        ? await api.put(`/clients/${client.id}`, payload)
        : await api.post('/clients', payload)

      onSave(savedClient as Client)
      onClose()
    } catch (err) {
      console.error('Failed to save client:', err)
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
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{client ? 'Edit Client' : 'Add Client'}</h2>
                <p className="text-sm text-slate-500">Manage contact details and attach multiple tags.</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => {
                      setForm({ ...form, name: event.target.value })
                      if (!touched.name) markTouched('name')
                    }}
                    onBlur={() => markTouched('name')}
                    placeholder="e.g. Priya Kapoor"
                    className={fieldClasses(nameError)}
                  />
                  {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => {
                      setForm({ ...form, phone: event.target.value })
                      if (!touched.phone) markTouched('phone')
                    }}
                    onBlur={() => markTouched('phone')}
                    placeholder="e.g. 9876543210"
                    className={fieldClasses(phoneError)}
                  />
                  {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => {
                      setForm({ ...form, email: event.target.value })
                      if (!touched.email) markTouched('email')
                    }}
                    onBlur={() => markTouched('email')}
                    placeholder="e.g. priya@agency.com"
                    className={fieldClasses(emailError)}
                  />
                  {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(event) => setForm({ ...form, company: event.target.value })}
                    placeholder="e.g. Pulse Media"
                    className={fieldClasses(null)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Client Tags</label>
                {availableTags.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    No tags created yet. Add tags in Settings → Client Tags.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => {
                        const selected = form.tag_ids.includes(tag.id)
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTagSelection(tag.id)}
                            className={cn(
                              'rounded-full border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500/20',
                              selected ? 'shadow-sm ring-1 ring-offset-1 ring-offset-slate-50' : 'opacity-75 hover:opacity-100',
                            )}
                            style={getClientTagStyles(tag.color)}
                          >
                            {tag.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={4}
                  placeholder="Any additional notes..."
                  className={`${fieldClasses(null)} resize-none`}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={cn('btn-primary', !isFormValid && 'cursor-not-allowed opacity-60')}
                >
                  {saving ? 'Saving...' : client ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
