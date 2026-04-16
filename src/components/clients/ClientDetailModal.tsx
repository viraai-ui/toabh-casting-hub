import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Mail, MessageCircle, Phone, Pencil, Sparkles, Trash2, X } from 'lucide-react'
import { cn, formatDate, getInitials } from '@/lib/utils'
import type { Casting, Client, ClientTag } from '@/types'
import { ClientTagPill } from '@/components/clients/ClientTagPill'

interface Props {
  open: boolean
  client: Client | null
  castings: Casting[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ClientDetailModal({ open, client, castings, onClose, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (confirmDelete) {
      setConfirmDelete(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!client) return null

  const whatsappNumber = client.phone
    ? client.phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '')
    : ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="client-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Panel — full-screen sheet on mobile, centered modal on desktop */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative w-full sm:w-auto sm:max-w-lg sm:rounded-2xl',
              'max-h-[92vh] sm:max-h-[90vh] bg-white overflow-y-auto',
              'shadow-2xl',
            )}
          >
            {/* Sticky Header */}
            <div className={cn(
              'sticky top-0 z-10 flex items-center justify-between',
              'border-b border-slate-100 bg-white/95 backdrop-blur-sm',
              'px-5 py-4 sm:px-6',
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-semibold text-white">
                  {getInitials(client.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{client.name}</h3>
                  {client.company && (
                    <p className="truncate text-xs text-slate-500">{client.company}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  aria-label="Delete client"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                  aria-label="Edit client"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close detail"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-5 sm:px-6 space-y-6">
              {/* Contact */}
              <div className="space-y-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Contact</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 hover:border-blue-200 hover:bg-blue-50 transition"
                    >
                      <Phone className="h-4 w-4 text-slate-400" />
                      {client.phone}
                    </a>
                  )}
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 hover:border-blue-200 hover:bg-blue-50 transition"
                    >
                      <Mail className="h-4 w-4 text-slate-400" />
                      {client.email}
                    </a>
                  )}
                  {client.company && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      {client.company}
                    </div>
                  )}
                  {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 hover:border-green-200 hover:bg-green-50 transition"
                    >
                      <MessageCircle className="h-4 w-4 text-slate-400" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* Tags */}
              {(client.tags ?? []).length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tags</span>
                  <div className="flex flex-wrap gap-2">
                    {(client.tags ?? []).map((tag: ClientTag) => (
                      <ClientTagPill key={tag.id} tag={tag} />
                    ))}
                  </div>
                </div>
              )}

              {/* Castings stats */}
              <div className="space-y-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Castings · {castings.length} total
                </span>
                {castings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">No castings linked yet</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          This client is ready to be attached to upcoming casting activity. Once a project is assigned, it will show up here for quick tracking.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {castings.slice(0, 5).map((casting) => (
                      <div
                        key={casting.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {casting.project_name || 'Untitled'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {casting.shoot_date_start ? formatDate(casting.shoot_date_start) : 'No date'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 ml-3 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                            casting.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            casting.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                            casting.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600',
                          )}
                        >
                          {casting.status}
                        </span>
                      </div>
                    ))}
                    {castings.length > 5 && (
                      <p className="text-xs text-slate-400 text-center">+{castings.length - 5} more castings</p>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Notes</span>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3">
                  {client.notes?.trim() ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {client.notes}
                    </p>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Pencil className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">No internal notes yet</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Add context like preferences, billing cues, team contacts, or follow-up instructions so handoffs stay sharp.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Created {client.created_at ? formatDate(client.created_at) : ''}</span>
                  <span>Updated {client.updated_at ? formatDate(client.updated_at) : ''}</span>
                </div>
              </div>
            </div>

            {/* Delete Confirmation Overlay */}
            <AnimatePresence>
              {confirmDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm sm:rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Delete Client</h4>
                        <p className="text-xs text-slate-500">This action cannot be undone.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-5">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete(false)
                          onDelete()
                        }}
                        className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
