import React, { useEffect, useRef } from 'react'
import { X, Edit2, Phone, MessageCircle, MapPin, User, Tag } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { getInitials } from '@/lib/utils'
import type { Casting } from '@/types'
import { CastingCommunicationPanel } from './casting/CastingCommunicationPanel'

interface TeamMemberInfo {
  id: number
  name: string
  role?: string
}

interface CastingDetailModalProps {
  open: boolean
  onClose: () => void
  onEdit: () => void
  casting: Casting | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW:        { bg: 'bg-blue-50 text-blue-700 border-blue-200',     text: '' },
  IN_PROGRESS:{ bg: 'bg-amber-50 text-amber-700 border-amber-200',   text: '' },
  REVIEW:     { bg: 'bg-purple-50 text-purple-700 border-purple-200',text: '' },
  SHORTLISTED:{ bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',     text: '' },
  COMPLETED:  { bg: 'bg-green-50 text-green-700 border-green-200',  text: '' },
  OFFERED:    { bg: 'bg-pink-50 text-pink-700 border-pink-200',    text: '' },
  REJECTED:   { bg: 'bg-red-50 text-red-700 border-red-200',       text: '' },
  CANCELLED:  { bg: 'bg-slate-100 text-slate-600 border-slate-200',text: '' },
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <Icon size={13} className="text-amber-500 shrink-0" />
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
        {label}
      </span>
    </div>
  )
}

function FieldRow({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  if (!value && !action) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-2.5 border-t border-slate-100/60 first:border-t-0">
      <span className="text-[12px] text-slate-400 font-medium sm:w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">
        {value && <span className="text-[13px] text-slate-700 leading-relaxed">{value}</span>}
        {action && <div className="mt-1.5 flex items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-4 pb-4 text-[12px] text-slate-400 italic">{message}</div>
}

export function CastingDetailModal({ open, onClose, onEdit, casting }: CastingDetailModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
    }
  }, [open, casting?.id])

  if (!casting) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-white/20 w-full max-w-lg p-8 sm:p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Parse custom fields
  let parsedCustomFields: Record<string, string> = {}
  if (casting.custom_fields) {
    try {
      parsedCustomFields = JSON.parse(casting.custom_fields)
    } catch { /* ignore */ }
  }
  const customFieldEntries = Object.entries(parsedCustomFields).filter(
    ([, v]) => v !== '' && v != null
  )

  // Parse assigned_to
  const assignedTo: TeamMemberInfo[] = Array.isArray(casting.assigned_to)
    ? casting.assigned_to.map((m: any) => ({
        id: typeof m.id === 'string' ? parseInt(m.id) : (m.id ?? 0),
        name: m.name || '',
        role: m.role,
      }))
    : []

  const hasBudget =
    (casting.budget_min != null && casting.budget_min > 0) ||
    (casting.budget_max != null && casting.budget_max > 0)

  // Phone links
  const phoneRaw = casting.client_contact || ''
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  const phoneLink = phoneRaw.startsWith('+') ? `tel:${phoneRaw}` : phoneDigits ? `tel:+91${phoneDigits}` : null
  const waLink = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=Regarding ${encodeURIComponent(casting.project_name || 'your casting')}`
    : null

  // Status badge
  const statusKey = casting.status?.toUpperCase() ?? 'NEW'
  const statusColors = STATUS_COLORS[statusKey] ?? STATUS_COLORS.NEW

  // Format date
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return null
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return d
    }
  }

  const pb = (text: string | null | undefined) => text ?? null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80 shrink-0">
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-50 hover:border-amber-400 transition-all"
                >
                  <Edit2 size={13} />
                  Edit
                </button>
              </div>

              {/* Scrollable content */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-5xl p-5 flex flex-col gap-4">

                  {/* Title + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[17px] font-bold text-slate-800 leading-snug">
                      {pb(casting.project_name) ?? <span className="text-slate-400 italic font-normal">Untitled Casting</span>}
                    </h2>
                    {casting.status && (
                      <span className={`shrink-0 px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${statusColors.bg}`}>
                        {casting.status}
                      </span>
                    )}
                  </div>

                  {/* CLIENT */}
                  <SectionCard>
                    <SectionHeader icon={User} label="Client" />
                    <FieldRow
                      label="Name"
                      value={pb(casting.client_name) ?? '—'}
                    />
                    {casting.client_contact && (
                      <FieldRow
                        label="Phone"
                        value={casting.client_contact}
                        action={
                          <>
                            {phoneLink && (
                              <a
                                href={phoneLink}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
                              >
                                <Phone size={10} />
                                Call
                              </a>
                            )}
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-400 transition-all"
                              >
                                <MessageCircle size={10} />
                                WhatsApp
                              </a>
                            )}
                          </>
                        }
                      />
                    )}
                    {casting.client_email && (
                      <FieldRow
                        label="Email"
                        value={
                          <a
                            href={`mailto:${casting.client_email}`}
                            className="text-amber-600 hover:text-amber-700 hover:underline"
                          >
                            {casting.client_email}
                          </a>
                        }
                      />
                    )}
                    <FieldRow
                      label="Company"
                      value={pb(casting.client_company) ?? '—'}
                    />
                  </SectionCard>

                  {/* DETAILS */}
                  <SectionCard>
                    <SectionHeader icon={Tag} label="Details" />
                    <FieldRow
                      label="Description"
                      value={casting.requirements ? (
                        <span className="whitespace-pre-wrap text-[13px] text-slate-600 leading-relaxed">
                          {casting.requirements}
                        </span>
                      ) : null}
                    />
                    <FieldRow
                      label="Location"
                      value={pb(casting.location) ?? '—'}
                      action={
                        casting.location ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(casting.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium"
                          >
                            <MapPin size={10} />
                            View on Maps
                          </a>
                        ) : undefined
                      }
                    />
                    <FieldRow
                      label="Start Date"
                      value={fmtDate(casting.shoot_date_start) ?? '—'}
                    />
                    <FieldRow
                      label="End Date"
                      value={fmtDate(casting.shoot_date_end) ?? '—'}
                    />
                    <FieldRow
                      label="Lead Source"
                      value={pb(casting.source) ?? '—'}
                    />
                  </SectionCard>

                  {/* TEAM */}
                  <SectionCard>
                    <SectionHeader icon={User} label="Team" />
                    {assignedTo.length === 0 ? (
                      <EmptyState message="No team members assigned" />
                    ) : (
                      <div className="px-4 pb-3 pt-1 flex flex-col gap-2">
                        {assignedTo.map((member) => (
                          <div key={member.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                              {getInitials(member.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">
                                {member.name}
                              </p>
                              {member.role && (
                                <p className="text-[11px] text-slate-400 leading-tight">{member.role}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* BUDGET */}
                  {hasBudget && (
                    <SectionCard>
                      <SectionHeader icon={Tag} label="Budget" />
                      <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                        {casting.budget_min != null && casting.budget_min > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-slate-400">Min Budget</span>
                            <span className="text-[13px] font-semibold text-slate-700">
                              ₹{casting.budget_min.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                        {casting.budget_max != null && casting.budget_max > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-slate-400">Max Budget</span>
                            <span className="text-[13px] font-semibold text-slate-700">
                              ₹{casting.budget_max.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  )}

                  {/* CUSTOM FIELDS */}
                  {customFieldEntries.length > 0 && (
                    <SectionCard>
                      <SectionHeader icon={Tag} label="Custom Fields" />
                      <div className="pb-3 pt-1">
                        {customFieldEntries.map(([key, value]) => (
                          <FieldRow
                            key={key}
                            label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            value={String(value)}
                          />
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  <CastingCommunicationPanel casting={casting} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
