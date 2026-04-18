import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Upload, Phone, MessageCircle, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getInitials } from '@/lib/utils'
import type { Talent } from '@/types'
import { toast } from 'sonner'
import { TalentDetailModal } from '@/components/TalentDetailModal'
import { TalentImportModal } from '@/components/TalentImportModal'

function TalentSummaryCard({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number
  note: string
  tone: string
}) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  )
}

function getTalentProfileSignal(talent: Talent) {
  const hasInstagram = Boolean(talent.instagram_handle?.trim())
  const hasPhone = Boolean(talent.phone?.trim())
  const hasEmail = Boolean(talent.email?.trim())
  const completeCount = [hasInstagram, hasPhone, hasEmail].filter(Boolean).length
  const score = Math.round((completeCount / 3) * 100)

  if (score === 100) {
    return {
      score,
      label: 'Ready',
      nextAction: 'Profile is ops-ready',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (!hasInstagram) {
    return {
      score,
      label: 'Needs Instagram',
      nextAction: 'Add Instagram handle',
      className: 'border-violet-200 bg-violet-50 text-violet-700',
    }
  }

  if (!hasPhone) {
    return {
      score,
      label: 'Needs phone',
      nextAction: 'Add phone number',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    score,
    label: 'Needs email',
    nextAction: 'Add email address',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  }
}

export function Talents() {
  const [talents, setTalents] = useState<Talent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusFilter, setFocusFilter] = useState<'all' | 'needs-attention' | 'ops-ready' | 'contactable' | 'missing-instagram'>('all')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'updated_at',
    direction: 'desc',
  })

  // Modals
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const fetchTalents = useCallback(async () => {
    try {
      const data = await api.get('/talents')
      setTalents(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch talents:', err)
      toast.error('Failed to load talents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTalents()
  }, [fetchTalents])

  useDataRefresh(() => {
    void fetchTalents()
  })

  const filteredTalents = useMemo(() => {
    let results = talents
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.phone || '').toLowerCase().includes(q) ||
          (t.email || '').toLowerCase().includes(q) ||
          (t.instagram_handle || '').toLowerCase().includes(q)
      )
    }

    if (focusFilter === 'needs-attention') {
      results = results.filter((talent) => getTalentProfileSignal(talent).score < 100)
    }

    if (focusFilter === 'ops-ready') {
      results = results.filter((talent) => getTalentProfileSignal(talent).score === 100)
    }

    if (focusFilter === 'contactable') {
      results = results.filter((talent) => Boolean(talent.phone?.trim()) || Boolean(talent.email?.trim()))
    }

    if (focusFilter === 'missing-instagram') {
      results = results.filter((talent) => !talent.instagram_handle?.trim())
    }

    return [...results].sort((a, b) => {
      const key = sortConfig.key

      if (key === 'profile_score') {
        const aScore = getTalentProfileSignal(a).score
        const bScore = getTalentProfileSignal(b).score
        return sortConfig.direction === 'asc' ? aScore - bScore : bScore - aScore
      }

      let aVal: string | number = (a as Record<string, string | number | null>)[key] ?? ''
      let bVal: string | number = (b as Record<string, string | number | null>)[key] ?? ''

      if (key === 'updated_at' || key === 'created_at') {
        aVal = aVal ? new Date(aVal as string).getTime() : 0
        bVal = bVal ? new Date(bVal as string).getTime() : 0
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      const cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base', numeric: true })
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [focusFilter, talents, searchQuery, sortConfig])

  const talentSummary = useMemo(() => {
    const withInstagram = filteredTalents.filter((talent) => Boolean(talent.instagram_handle?.trim())).length
    const withPhone = filteredTalents.filter((talent) => Boolean(talent.phone?.trim())).length
    const withEmail = filteredTalents.filter((talent) => Boolean(talent.email?.trim())).length
    const completeProfiles = filteredTalents.filter(
      (talent) => Boolean(talent.instagram_handle?.trim()) && Boolean(talent.phone?.trim()) && Boolean(talent.email?.trim()),
    ).length
    const contactable = filteredTalents.filter((talent) => Boolean(talent.phone?.trim()) || Boolean(talent.email?.trim())).length
    const opsReady = filteredTalents.filter((talent) => getTalentProfileSignal(talent).score === 100).length
    const missingInstagram = filteredTalents.filter((talent) => !talent.instagram_handle?.trim()).length
    const partialProfiles = filteredTalents.filter((talent) => {
      const score = getTalentProfileSignal(talent).score
      return score > 0 && score < 100
    }).length

    return {
      total: filteredTalents.length,
      withInstagram,
      withPhone,
      withEmail,
      completeProfiles,
      contactable,
      opsReady,
      missingInstagram,
      partialProfiles,
      incompleteProfiles: Math.max(filteredTalents.length - completeProfiles, 0),
    }
  }, [filteredTalents])

  const talentHealth = useMemo(() => {
    if (talentSummary.total === 0) {
      return {
        label: 'Roster is empty',
        note: 'Add or import talent to build the flagship roster layer.',
        tone: 'border-slate-200 bg-slate-50 text-slate-700',
      }
    }

    if (talentSummary.incompleteProfiles > 0) {
      return {
        label: `${talentSummary.incompleteProfiles} profile${talentSummary.incompleteProfiles === 1 ? '' : 's'} need enrichment`,
        note: 'A chunk of the roster is still missing contact or profile depth.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    }

    return {
      label: 'Roster health looks strong',
      note: 'Most visible talent records are ready for quick outreach and review.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }, [talentSummary])

  const rosterPriority = useMemo(() => {
    const missingInstagram = filteredTalents.filter((talent) => !talent.instagram_handle?.trim()).length
    const missingPhone = filteredTalents.filter((talent) => !talent.phone?.trim()).length
    const missingEmail = filteredTalents.filter((talent) => !talent.email?.trim()).length

    const candidates = [
      {
        count: missingInstagram,
        label: 'Instagram coverage is the main roster gap',
        note: 'Social presence is still the weakest field across visible talent.',
        tone: 'border-violet-200 bg-violet-50 text-violet-700',
      },
      {
        count: missingPhone,
        label: 'Phone coverage is the main roster gap',
        note: 'Direct outreach speed is still limited by missing phone numbers.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      },
      {
        count: missingEmail,
        label: 'Email coverage is the main roster gap',
        note: 'Formal outreach is still limited by missing email addresses.',
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
      },
    ].sort((a, b) => b.count - a.count)

    const winner = candidates[0]
    if (!winner || winner.count === 0) {
      return {
        label: 'No obvious roster gap right now',
        note: 'Core profile coverage looks balanced across the visible roster.',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      }
    }

    return {
      label: winner.label,
      note: `${winner.count} profile${winner.count === 1 ? '' : 's'} are missing this field. ${winner.note}`,
      tone: winner.tone,
    }
  }, [filteredTalents])

  const rosterSignals = [
    {
      label: 'Roster focus',
      value: focusFilter === 'all' ? 'Full roster view' : focusFilter === 'needs-attention' ? 'Needs attention' : focusFilter === 'ops-ready' ? 'Ops-ready only' : focusFilter === 'contactable' ? 'Contactable only' : 'Missing Instagram',
      note: focusFilter === 'all' ? 'You are looking at the broadest talent bench.' : 'The roster is narrowed to a specific readiness slice right now.',
    },
    {
      label: 'Search state',
      value: searchQuery.trim() ? 'Search active' : 'No search applied',
      note: searchQuery.trim() ? 'The visible roster is narrowed before you assess profile readiness.' : 'No search filter is trimming the current roster view.',
    },
    {
      label: 'Visible bench',
      value: `${filteredTalents.length}/${talents.length} visible`,
      note: talents.length === 0 ? 'The talent database has not been seeded yet.' : 'This shows how much of the roster is visible inside the current lens.',
    },
  ]

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const openDetail = (talent: Talent | null) => {
    setSelectedTalent(talent)
    setDetailOpen(true)
  }

  // Sort arrow helper
  const SortArrow = ({ sortKey }: { sortKey: string }) => {
    if (sortConfig.key !== sortKey) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Talents
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              The visual roster, ready for fast search and action.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 1 keeps this list efficient while setting up the stronger premium talent experience to come.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={() => {
                setSelectedTalent(null)
                openDetail(null)
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add talent
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <TalentSummaryCard label="Visible roster" value={talentSummary.total} note="Talent records in the current filtered view." tone="bg-slate-50 text-slate-700 border-slate-200/70" />
        <TalentSummaryCard label="Contactable" value={talentSummary.contactable} note="Phone or email is available for fast outreach." tone="bg-emerald-50 text-emerald-700 border-emerald-200/70" />
        <TalentSummaryCard label="Instagram linked" value={talentSummary.withInstagram} note="Profiles with social presence attached." tone="bg-violet-50 text-violet-700 border-violet-200/70" />
        <TalentSummaryCard label="Complete profiles" value={talentSummary.completeProfiles} note="Instagram, phone, and email all present." tone="bg-blue-50 text-blue-700 border-blue-200/70" />
        <TalentSummaryCard label="Ops-ready" value={talentSummary.opsReady} note="Profiles already complete enough for fast roster execution." tone="bg-emerald-50 text-emerald-700 border-emerald-200/70" />
      </section>

      <section className={`rounded-3xl border px-5 py-4 shadow-sm ${talentHealth.tone}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">Roster health</p>
              <p className="mt-1 text-base font-semibold text-slate-950">{talentHealth.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{talentHealth.note}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
                {talentSummary.incompleteProfiles} need enrichment
              </div>
              <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
                {talentSummary.withPhone}/{talentSummary.total} have phone
              </div>
              <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-black/5">
                {talentSummary.partialProfiles} partially ready
              </div>
            </div>
          </div>
          <div className={`rounded-2xl border px-3 py-3 shadow-sm ${rosterPriority.tone}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Roster priority</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{rosterPriority.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{rosterPriority.note}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {rosterSignals.map((signal) => (
          <div key={signal.label} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{signal.label}</p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{signal.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{signal.note}</p>
          </div>
        ))}
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search talent by name, phone, email, or Instagram..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
            />
          </div>

          <div className="hidden sm:block h-10 w-px bg-slate-200" aria-hidden="true" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: `All roster (${talentSummary.total})` },
            { key: 'needs-attention', label: `Needs attention (${talentSummary.incompleteProfiles})` },
            { key: 'ops-ready', label: `Ops-ready (${talentSummary.opsReady})` },
            { key: 'contactable', label: `Contactable (${talentSummary.contactable})` },
            { key: 'missing-instagram', label: `Missing Instagram (${talentSummary.missingInstagram})` },
          ].map((option) => {
            const active = focusFilter === option.key
            return (
              <button
                key={option.key}
                onClick={() => setFocusFilter(option.key as 'all' | 'needs-attention' | 'ops-ready' | 'contactable' | 'missing-instagram')}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {option.label}
              </button>
            )
          })}
          <button
            onClick={() => setSortConfig({ key: 'profile_score', direction: 'asc' })}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${sortConfig.key === 'profile_score' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Lowest profile score first
          </button>
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || focusFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Showing {filteredTalents.length} of {talents.length} talent{talents.length !== 1 ? 's' : ''}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{talentSummary.contactable} contactable</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{talentSummary.missingInstagram} missing Instagram</span>
        </div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
      >
        {filteredTalents.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Talent roster</p>
            <p className="mt-3 text-5xl">🎭</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">No talent yet</p>
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery ? 'No results match your search or focus filters.' : 'Add your first talent or import a CSV to start building the roster.'}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              The roster will become your fast scan for contactability, Instagram coverage, and shortlist readiness.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{talents.length} total talents</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">Focus: {focusFilter}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">Search: {searchQuery ? 'on' : 'off'}</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">If the roster should be visible here, clear search first, then reset the focus chips. Otherwise, this usually means the selected talent slice is already clean.</p>
            <p className="mt-2 text-xs text-slate-400">Once the database fills out, this becomes the casting bench for discovery, outreach, and shortlist depth.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th
                    className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    Talent Name <SortArrow sortKey="name" />
                  </th>
                  <th
                    className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-900 select-none hidden md:table-cell"
                    onClick={() => handleSort('instagram_handle')}
                  >
                    Instagram <SortArrow sortKey="instagram_handle" />
                  </th>
                  <th
                    className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('phone')}
                  >
                    Phone <SortArrow sortKey="phone" />
                  </th>
                  <th
                    className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-900 select-none hidden md:table-cell"
                    onClick={() => handleSort('email')}
                  >
                    Email <SortArrow sortKey="email" />
                  </th>
                  <th
                    className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden lg:table-cell cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('profile_score')}
                  >
                    Profile status <SortArrow sortKey="profile_score" />
                  </th>
                  <th className="text-right px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTalents.map((talent) => {
                  const profileSignal = getTalentProfileSignal(talent)

                  return (
                  <tr
                    key={talent.id}
                    className="border-b border-slate-50 hover:bg-amber-50/30 transition-colors cursor-pointer last:border-b-0"
                    onClick={() => openDetail(talent)}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-amber-700">{getInitials(talent.name)}</span>
                        </div>
                        <span className="font-medium text-slate-900 truncate max-w-[180px]">{talent.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 hidden md:table-cell">
                      {talent.instagram_handle ? (
                        <a
                          href={`https://instagram.com/${talent.instagram_handle.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700 hover:underline text-xs truncate block max-w-[150px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{talent.instagram_handle.replace(/^@/, '')}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-slate-600 text-xs">{talent.phone || '—'}</span>
                    </td>
                    <td className="px-6 py-3 hidden md:table-cell">
                      {talent.email ? (
                        <a
                          href={`mailto:${talent.email}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline text-xs truncate block max-w-[180px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {talent.email}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 hidden lg:table-cell">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${profileSignal.className}`}>
                          {profileSignal.label} · {profileSignal.score}%
                        </span>
                        <p className="text-[11px] text-slate-500">{profileSignal.nextAction}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {/* Call */}
                        {talent.phone && (
                          <a
                            href={`tel:${talent.phone}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            title="Call"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {/* WhatsApp */}
                        {talent.phone && (
                          <a
                            href={`https://wa.me/${talent.phone.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      <TalentDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        talent={selectedTalent}
        onSave={fetchTalents}
      />

      {/* Import Modal */}
      <TalentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchTalents}
      />
    </div>
  )
}
