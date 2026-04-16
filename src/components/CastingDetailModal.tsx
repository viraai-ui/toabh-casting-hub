import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, Edit2, Phone, MessageCircle, MapPin, User, Tag, Users, Briefcase, Clock3, CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { getInitials } from '@/lib/utils'
import type { Casting, Talent } from '@/types'
import { CastingCommunicationPanel } from './casting/CastingCommunicationPanel'
import { api } from '@/lib/api'
import { TalentDetailModal } from './TalentDetailModal'

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

function EmptyState({
  message,
  eyebrow = 'Waiting on data',
}: {
  message: string
  eyebrow?: string
}) {
  return (
    <div className="px-4 pb-4">
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-4 py-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <p className="mt-2 text-[12px] leading-5 text-slate-600">{message}</p>
      </div>
    </div>
  )
}

function WorkflowStat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone: string
}) {
  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{note}</p>
    </div>
  )
}

interface CastingTalentLink {
  talent_id: number
  name: string
  phone?: string | null
  email?: string | null
  instagram_handle?: string | null
}

export function CastingDetailModal({ open, onClose, onEdit, casting }: CastingDetailModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Linked talents
  const [talents, setTalents] = useState<Talent[]>([])
  const [talentsLoading, setTalentsLoading] = useState(true)
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null)
  const [talentDetailOpen, setTalentDetailOpen] = useState(false)

  useEffect(() => {
    if (!casting?.id || !open) return

    let active = true
    void api.get(`/castings/${casting.id}/talents`)
      .then((data: unknown) => {
        if (!active) return
        const arr = Array.isArray(data) ? data as CastingTalentLink[] : []
        setTalents(arr.map((t) => ({
          id: t.talent_id,
          name: t.name,
          phone: t.phone ?? null,
          email: t.email ?? null,
          instagram_handle: t.instagram_handle ?? null,
        })))
      })
      .catch(() => {
        if (active) setTalents([])
      })
      .finally(() => {
        if (active) setTalentsLoading(false)
      })

    return () => {
      active = false
    }
  }, [casting?.id, open])

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
    ? casting.assigned_to.map((m) => ({
        id: m.id,
        name: m.name || '',
        role: m.role,
      }))
    : []

  const hasBudget =
    (casting.budget_min != null && casting.budget_min > 0) ||
    (casting.budget_max != null && casting.budget_max > 0)

  const workflowStage = useMemo(() => {
    const normalized = (casting.status || 'NEW').toUpperCase()
    if (['COMPLETED', 'CONFIRMED', 'BOOKED', 'WON'].includes(normalized)) {
      return {
        phase: 'Confirmed',
        note: 'This job is already in a committed or closed state.',
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    }
    if (['SHORTLISTED', 'OFFERED', 'REVIEW'].includes(normalized)) {
      return {
        phase: 'Decision',
        note: 'Client-side movement is happening, this needs tight follow-through.',
        tone: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      }
    }
    if (['IN_PROGRESS', 'ACTIVE'].includes(normalized)) {
      return {
        phase: 'Submission',
        note: 'This job is active and moving, talent coordination matters now.',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }
    if (['REJECTED', 'CANCELLED', 'LOST'].includes(normalized)) {
      return {
        phase: 'Closed',
        note: 'This job is closed and should mostly stay in history unless reopened.',
        tone: 'bg-slate-100 text-slate-600 border-slate-200',
      }
    }
    return {
      phase: 'Intake',
      note: 'This brief still needs coordination, assignment, and talent movement.',
      tone: 'bg-blue-50 text-blue-700 border-blue-200',
    }
  }, [casting.status])

  const timelineNote = useMemo(() => {
    if (casting.shoot_date_start) {
      return `Shoot starts ${fmtDate(casting.shoot_date_start)}`
    }
    return 'No shoot date locked yet'
  }, [casting.shoot_date_start])

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

  const freshnessSignal = useMemo(() => {
    const sourceDate = casting.updated_at || casting.created_at
    if (!sourceDate) {
      return {
        label: 'No activity date',
        note: 'This record has no visible freshness signal yet.',
        tone: 'bg-white text-slate-700 border-slate-200',
      }
    }

    const ageHours = (Date.now() - new Date(sourceDate).getTime()) / (1000 * 60 * 60)

    if (ageHours <= 24) {
      return {
        label: 'Touched today',
        note: 'Recently worked and still fresh.',
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    }

    if (ageHours <= 72) {
      return {
        label: 'Touched this week',
        note: 'Still active, but should keep moving.',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }

    return {
      label: 'Stale',
      note: 'Untouched for more than 3 days and likely needs follow-up.',
      tone: 'bg-violet-50 text-violet-700 border-violet-200',
    }
  }, [casting.created_at, casting.updated_at])

  const readinessChecklist = [
    { label: 'Project name captured', done: Boolean(casting.project_name?.trim()) },
    { label: 'Client attached', done: Boolean(casting.client_name?.trim()) },
    { label: 'Internal owner assigned', done: assignedTo.length > 0 },
    { label: 'Brief notes added', done: Boolean(casting.requirements?.trim()) },
    { label: 'Shoot timing locked', done: Boolean(casting.shoot_date_start) },
    { label: 'Talent linked', done: talents.length > 0 },
  ]
  const missingReadinessItems = readinessChecklist.filter((item) => !item.done)

  const workflowNextStep = useMemo(() => {
    if (!casting.project_name?.trim() || !casting.client_name?.trim()) {
      return {
        title: 'Complete intake first',
        note: 'Lock the project and client basics before this job moves deeper into operations.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    }

    if (assignedTo.length === 0) {
      return {
        title: 'Assign internal ownership',
        note: 'Put a named owner on this job so follow-through does not get lost.',
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
      }
    }

    if (!casting.requirements?.trim()) {
      return {
        title: 'Tighten the brief',
        note: 'Add clearer requirements so the team can move talent with confidence.',
        tone: 'border-violet-200 bg-violet-50 text-violet-700',
      }
    }

    if (['SHORTLISTED', 'OFFERED', 'REVIEW'].includes((casting.status || 'NEW').toUpperCase())) {
      return {
        title: 'Push client decision follow-up',
        note: 'This record is already in a decision-sensitive stage and needs quick follow-through.',
        tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      }
    }

    if (talents.length === 0) {
      return {
        title: 'Start shortlist movement',
        note: 'The record is structured enough, now it needs the first talent layer attached.',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      }
    }

    return {
      title: 'Advance active ops movement',
      note: 'Use this record to manage submissions, follow-through, and final booking conversion.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }, [assignedTo.length, casting.client_name, casting.project_name, casting.requirements, casting.status, talents.length])

  const workflowRisk = useMemo(() => {
    if (!casting.project_name?.trim() || !casting.client_name?.trim()) {
      return {
        label: 'High risk',
        note: 'Intake is still incomplete, so execution can stall quickly.',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }

    if (assignedTo.length === 0 || !casting.requirements?.trim()) {
      return {
        label: 'Medium risk',
        note: 'Core structure exists, but missing ownership or brief depth can slow movement.',
        tone: 'bg-blue-50 text-blue-700 border-blue-200',
      }
    }

    if (freshnessSignal.label === 'Stale') {
      return {
        label: 'Watch closely',
        note: 'The record is structurally sound, but it has gone stale and needs follow-up.',
        tone: 'bg-violet-50 text-violet-700 border-violet-200',
      }
    }

    return {
      label: 'Low risk',
      note: 'This job looks healthy enough for active workflow movement.',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }, [assignedTo.length, casting.client_name, casting.project_name, casting.requirements, freshnessSignal.label])

  const workflowScore = useMemo(() => {
    const readyCount = readinessChecklist.filter((item) => item.done).length
    const score = Math.round((readyCount / readinessChecklist.length) * 100)

    if (score >= 85) {
      return {
        value: `${score}%`,
        note: 'This record is operationally strong and close to fully structured.',
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    }

    if (score >= 50) {
      return {
        value: `${score}%`,
        note: 'Core structure exists, but the workflow still needs a few pieces tightened.',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }

    return {
      value: `${score}%`,
      note: 'This record still needs significant setup before the workflow is solid.',
      tone: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  }, [readinessChecklist])

  const workflowPhaseSteps = [
    { label: 'Intake', active: workflowStage.phase === 'Intake', done: ['Submission', 'Decision', 'Confirmed', 'Closed'].includes(workflowStage.phase) },
    { label: 'Submission', active: workflowStage.phase === 'Submission', done: ['Decision', 'Confirmed', 'Closed'].includes(workflowStage.phase) },
    { label: 'Decision', active: workflowStage.phase === 'Decision', done: ['Confirmed', 'Closed'].includes(workflowStage.phase) },
    { label: 'Confirmed', active: workflowStage.phase === 'Confirmed', done: false },
  ]

  const pb = (text: string | null | undefined) => text ?? null
  const closeDisabled = talentDetailOpen

  const handleModalClose = () => {
    if (closeDisabled) return
    onClose()
  }

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
            onClick={handleModalClose}
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
                  onClick={handleModalClose}
                  disabled={closeDisabled}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

                  {/* WORKFLOW */}
                  <SectionCard>
                    <SectionHeader icon={Briefcase} label="Workflow" />
                    <div className="px-4 pb-4 pt-1">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          {workflowPhaseSteps.map((step, index) => (
                            <React.Fragment key={step.label}>
                              <div className="flex items-center gap-2">
                                <span className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[11px] font-semibold ${step.active ? 'border-amber-300 bg-amber-100 text-amber-700' : step.done ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                                  {index + 1}
                                </span>
                                <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${step.active ? 'text-slate-900' : step.done ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {step.label}
                                </span>
                              </div>
                              {index < workflowPhaseSteps.length - 1 && (
                                <div className={`hidden h-px flex-1 min-w-6 sm:block ${step.done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 px-4 pb-4 pt-1 sm:grid-cols-2 xl:grid-cols-6">
                      <WorkflowStat
                        label="Current phase"
                        value={workflowStage.phase}
                        note={workflowStage.note}
                        tone={workflowStage.tone}
                      />
                      <WorkflowStat
                        label="Linked talent"
                        value={talentsLoading ? '...' : String(talents.length)}
                        note={talents.length > 0 ? 'Talent already linked to this job.' : 'No talent attached yet, shortlist building is still open.'}
                        tone="bg-white text-slate-700 border-slate-200"
                      />
                      <WorkflowStat
                        label="Timeline"
                        value={casting.status || 'NEW'}
                        note={timelineNote}
                        tone="bg-white text-slate-700 border-slate-200"
                      />
                      <WorkflowStat
                        label="Freshness"
                        value={freshnessSignal.label}
                        note={freshnessSignal.note}
                        tone={freshnessSignal.tone}
                      />
                      <WorkflowStat
                        label="Ops risk"
                        value={workflowRisk.label}
                        note={workflowRisk.note}
                        tone={workflowRisk.tone}
                      />
                      <WorkflowStat
                        label="Workflow score"
                        value={workflowScore.value}
                        note={workflowScore.note}
                        tone={workflowScore.tone}
                      />
                    </div>
                    <div className="border-t border-slate-100 px-4 py-4">
                      <div className={`rounded-2xl border px-3 py-3 ${workflowNextStep.tone}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Recommended next step</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{workflowNextStep.title}</p>
                        <p className="mt-1 text-[12px] leading-5 text-slate-600">{workflowNextStep.note}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 border-t border-slate-100 px-4 py-4 sm:grid-cols-3">
                      <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
                        <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-[12px] font-semibold text-slate-700">Next ops focus</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">{assignedTo.length > 0 ? 'Drive follow-up with the assigned team.' : 'Assign internal ownership before more work gets lost.'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
                        <Users className="mt-0.5 h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-[12px] font-semibold text-slate-700">Submission readiness</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">{talents.length > 0 ? 'Ready for shortlist movement and decision tracking.' : 'Still missing the first talent submission layer.'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-[12px] font-semibold text-slate-700">Outcome path</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">Use this record as the future base for submissions, holds, and confirmed booking flow.</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-semibold text-slate-700">Submission checklist</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">Makes missing workflow inputs explicit before the job moves deeper into ops.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {readinessChecklist.filter((item) => item.done).length}/{readinessChecklist.length} ready
                        </span>
                      </div>
                      {missingReadinessItems.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Missing before clean ops movement</p>
                          <p className="mt-1 text-[12px] leading-5 text-amber-800">
                            {missingReadinessItems.map((item) => item.label).join(' · ')}
                          </p>
                        </div>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {readinessChecklist.map((item) => (
                          <div
                            key={item.label}
                            className={`rounded-2xl border px-3 py-2.5 ${item.done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'}`}
                          >
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? 'text-emerald-600' : 'text-slate-300'}`} />
                              <div>
                                <p className="text-[12px] font-semibold text-slate-700">{item.label}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">{item.done ? 'Ready' : 'Missing'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  {/* CLIENT */}
                  <SectionCard>
                    <SectionHeader icon={User} label="Client" />
                    <FieldRow
                      label="Name"
                      value={pb(casting.client_name) ?? 'Client not added yet'}
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
                      value={pb(casting.client_company) ?? 'Company not added yet'}
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
                      value={pb(casting.location) ?? 'Location not added yet'}
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
                      value={fmtDate(casting.shoot_date_start) ?? 'Shoot date not locked yet'}
                    />
                    <FieldRow
                      label="End Date"
                      value={fmtDate(casting.shoot_date_end) ?? 'Wrap date not locked yet'}
                    />
                    <FieldRow
                      label="Lead Source"
                      value={pb(casting.source) ?? 'Source not added yet'}
                    />
                  </SectionCard>

                  {/* TALENTS */}
                  <SectionCard>
                    <SectionHeader icon={Users} label="Talents" />
                    {talentsLoading ? (
                      <div className="px-4 pb-4 pt-2 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[12px] text-slate-400">Loading talents...</span>
                      </div>
                    ) : talents.length === 0 ? (
                      <EmptyState
                        eyebrow="Talent queue open"
                        message="No talent has been linked yet. Add the first shortlist here to move this casting into active submission flow."
                        note="This is where the active shortlist starts taking shape for client review and internal decision-making."
                      />
                    ) : (
                      <div className="px-4 pb-3 pt-1 flex flex-col gap-2">
                        {talents.map((talent) => (
                          <div
                            key={talent.id}
                            onClick={() => { setSelectedTalent(talent); setTalentDetailOpen(true) }}
                            className="group flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-amber-300 hover:bg-amber-50/50 transition-all"
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                              {getInitials(talent.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{talent.name}</p>
                              {(talent.phone || talent.email) && (
                                <p className="text-[10px] text-slate-400 leading-tight truncate">
                                  {talent.phone}{talent.phone && talent.email ? ' · ' : ''}{talent.email}
                                </p>
                              )}
                            </div>
                            {talent.instagram_handle && (
                              <span className="text-[10px] text-purple-500 shrink-0">@{String(talent.instagram_handle).replace(/^@/, '')}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* TEAM */}
                  <SectionCard>
                    <SectionHeader icon={User} label="Team" />
                    {assignedTo.length === 0 ? (
                      <EmptyState
                        eyebrow="Ownership missing"
                        message="This casting still has no internal owner. Assign a team member so follow-through stays visible and accountable."
                      />
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

            {/* Talent detail popup */}
            <TalentDetailModal
              open={talentDetailOpen}
              onClose={() => {
                setTalentDetailOpen(false)
                setSelectedTalent(null)
                // Refresh talents after close
                if (casting?.id) {
                  api.get(`/castings/${casting.id}/talents`)
                    .then((data: unknown) => {
                      const arr = Array.isArray(data) ? data : []
                      setTalents(arr.map((t: Record<string, unknown>) => ({
                        id: t.talent_id as number,
                        name: t.name as string,
                        phone: t.phone as string | null,
                        email: t.email as string | null,
                        instagram_handle: t.instagram_handle as string | null,
                      })))
                    }).catch(() => {})
                }
              }}
              talent={selectedTalent}
              onSave={() => {}}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
