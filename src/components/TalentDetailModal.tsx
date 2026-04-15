import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Camera, Phone, Mail, Pencil, Trash2, Loader2, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { Talent } from '@/types'
import { toast } from 'sonner'

interface TalentDetailModalProps {
  open: boolean
  onClose: () => void
  talent: Talent | null
  onSave: () => void
}

export function TalentDetailModal({ open, onClose, talent, onSave }: TalentDetailModalProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(talent ? 'view' : 'create')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    instagram_handle: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    if (open) {
      if (talent) {
        setMode('view')
        setForm({
          name: talent.name,
          instagram_handle: talent.instagram_handle || '',
          phone: talent.phone || '',
          email: talent.email || '',
        })
      } else {
        setMode('create')
        setForm({ name: '', instagram_handle: '', phone: '', email: '' })
      }
    }
  }, [open, talent])

  const isBusy = saving || deleting

  const profileSignals = useMemo(() => {
    const hasInstagram = Boolean(form.instagram_handle?.trim())
    const hasPhone = Boolean(form.phone?.trim())
    const hasEmail = Boolean(form.email?.trim())
    const completeCount = [hasInstagram, hasPhone, hasEmail].filter(Boolean).length
    const completeness = Math.round((completeCount / 3) * 100)

    const profileHealth =
      completeness === 100
        ? {
            label: 'Profile is ready',
            note: 'This talent record has the core contact and profile fields needed for fast ops movement.',
            tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          }
        : completeness >= 67
          ? {
              label: 'Profile needs light enrichment',
              note: 'The talent is usable, but one missing field still weakens outreach speed.',
              tone: 'border-amber-200 bg-amber-50 text-amber-700',
            }
          : {
              label: 'Profile needs enrichment',
              note: 'This record still needs more structure before it feels production-ready.',
              tone: 'border-slate-200 bg-slate-50 text-slate-700',
            }

    const nextAction =
      !hasInstagram
        ? 'Add Instagram handle'
        : !hasPhone
          ? 'Add phone number'
          : !hasEmail
            ? 'Add email address'
            : 'Profile is ops-ready'

    return {
      hasInstagram,
      hasPhone,
      hasEmail,
      completeness,
      profileHealth,
      nextAction,
    }
  }, [form.email, form.instagram_handle, form.phone])

  const handleModalClose = () => {
    if (isBusy) return
    onClose()
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (form.email && !form.email.includes('@')) {
      toast.error('Please enter a valid email')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        instagram_handle: form.instagram_handle.replace(/^@/, '').trim() || null,
        phone: form.phone.trim(),
        email: form.email.trim(),
      }

      if (mode === 'create' && !talent) {
        await api.post('/talents', payload)
        toast.success('Talent added successfully')
      } else if (talent?.id) {
        await api.put(`/talents/${talent.id}`, payload)
        toast.success('Talent updated successfully')
      }
      onSave()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!talent?.id) return
    setDeleting(true)
    try {
      await api.del(`/talents/${talent.id}`)
      toast.success('Talent deleted')
      onSave()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleModalClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-amber-700">
                      {getInitials(form.name || talent?.name || 'T')}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {mode === 'create' ? 'Add New Talent' : talent?.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {mode === 'view' ? 'Viewing details' : mode === 'create' ? 'Fill in talent details' : 'Editing information'}
                    </p>
                  </div>
                </div>
                <button onClick={handleModalClose} disabled={isBusy} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                {mode === 'view' && (
                  <>
                    <section className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Profile score</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{profileSignals.completeness}%</p>
                        <p className="mt-2 text-xs leading-5 text-slate-600">Based on Instagram, phone, and email coverage.</p>
                      </div>
                      <div className={`rounded-2xl border p-4 ${profileSignals.profileHealth.tone}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Profile health</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{profileSignals.profileHealth.label}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{profileSignals.profileHealth.note}</p>
                      </div>
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Next action</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{profileSignals.nextAction}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-600">Keep the roster fast to review and fast to contact.</p>
                      </div>
                    </section>

                    <section className="grid gap-2 sm:grid-cols-3">
                      {[
                        { label: 'Instagram linked', done: profileSignals.hasInstagram },
                        { label: 'Phone ready', done: profileSignals.hasPhone },
                        { label: 'Email ready', done: profileSignals.hasEmail },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`rounded-2xl border px-3 py-3 ${item.done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'}`}
                        >
                          <div className="flex items-start gap-2">
                            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? 'text-emerald-600' : 'text-slate-300'}`} />
                            <div>
                              <p className="text-[12px] font-semibold text-slate-700">{item.label}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{item.done ? 'Ready' : 'Missing'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  </>
                )}
                {/* Avatar area for edit/create */}
                {mode !== 'view' && (
                  <div className="flex flex-col items-center mb-2">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                      <span className="text-xl font-bold text-amber-700">
                        {getInitials(form.name || 'T')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {mode === 'create' ? 'New talent profile' : 'Updating profile'}
                    </p>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
                  {mode === 'view' ? (
                    <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-900">{form.name || '—'}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Full name"
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Instagram Handle */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Instagram Handle</label>
                  {mode === 'view' ? (
                    <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                      <Camera className="w-4 h-4 text-slate-400" />
                      <a
                        href={form.instagram_handle ? `https://instagram.com/${form.instagram_handle.replace(/^@/, '')}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('text-sm', form.instagram_handle ? 'text-purple-600 underline' : 'text-slate-400')}
                      >
                        {form.instagram_handle ? `@${form.instagram_handle.replace(/^@/, '')}` : 'Not set'}
                      </a>
                    </div>
                  ) : (
                    <div className="relative">
                      <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={form.instagram_handle}
                        onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })}
                        placeholder="@username"
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Phone Number</label>
                  {mode === 'view' ? (
                    <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-900">{form.phone || 'Not set'}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+91 ..."
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Email ID</label>
                  {mode === 'view' ? (
                    <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <a href={form.email ? `mailto:${form.email}` : '#'} className={cn('text-sm', form.email ? 'text-blue-600 underline' : 'text-slate-400')}>
                        {form.email || 'Not set'}
                      </a>
                    </div>
                  ) : (
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                <div>
                  {mode === 'view' && talent?.id && (
                    <button
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  {mode === 'edit' && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {mode === 'edit' && (
                    <button
                      onClick={() => {
                        setMode('view')
                        setForm({
                          name: talent?.name || '',
                          instagram_handle: talent?.instagram_handle || '',
                          phone: talent?.phone || '',
                          email: talent?.email || '',
                        })
                      }}
                      disabled={isBusy}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  )}
                  {(mode === 'edit' || mode === 'create') && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Saving...' : mode === 'create' ? 'Add Talent' : 'Save'}
                    </button>
                  )}
                  {mode === 'view' && (
                    <button
                      onClick={handleModalClose}
                      disabled={isBusy}
                      className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
