import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Check, Loader2, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import {
  areCastingFiltersEqual,
  CASTING_PRESET_STORAGE_KEY,
  getMyCastingsFilters,
  normalizeCastingFilters,
  parseStoredCastingPresets,
  sanitizePresetName,
  upsertCastingPreset,
  type CastingFilters,
  type SavedCastingPreset,
} from '@/features/castings/filterPresets'
import type { PipelineStage, TeamMember } from '@/types'

interface AdvancedFiltersProps {
  pipeline: PipelineStage[]
  currentUserName?: string | null
  filters: CastingFilters
  onApply: (filters: CastingFilters) => void
  onReset: () => void
}

export function AdvancedFilters({
  pipeline,
  currentUserName,
  filters,
  onApply,
  onReset,
}: AdvancedFiltersProps) {
  const [draftFilters, setDraftFilters] = useState<CastingFilters>(filters)
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [presets, setPresets] = useState<SavedCastingPreset[]>(() =>
    parseStoredCastingPresets(localStorage.getItem(CASTING_PRESET_STORAGE_KEY))
  )

  useEffect(() => {
    setDraftFilters(filters)
  }, [filters])

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const data = await api.get('/team')
        setTeam(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to fetch team:', err)
      } finally {
        setLoadingTeam(false)
      }
    }

    fetchTeam()
  }, [])

  const normalizedDraftFilters = useMemo(() => normalizeCastingFilters(draftFilters), [draftFilters])
  const normalizedAppliedFilters = useMemo(() => normalizeCastingFilters(filters), [filters])
  const hasPendingChanges = !areCastingFiltersEqual(normalizedDraftFilters, normalizedAppliedFilters)

  const myCastingsFilters = useMemo(
    () => getMyCastingsFilters(team, currentUserName),
    [team, currentUserName]
  )

  const activePresetId = useMemo(() => {
    if (myCastingsFilters && areCastingFiltersEqual(normalizedAppliedFilters, myCastingsFilters)) {
      return 'my-jobs'
    }

    const matchingPreset = presets.find((preset) =>
      areCastingFiltersEqual(normalizedAppliedFilters, preset.filters)
    )

    return matchingPreset?.id ?? null
  }, [myCastingsFilters, normalizedAppliedFilters, presets])

  const updateFilter = (key: keyof CastingFilters, values: string[]) => {
    setDraftFilters((prev) => normalizeCastingFilters({ ...prev, [key]: values }))
  }

  const handleStatusChange = (status: string) => {
    const current = normalizedDraftFilters.status || []
    const updated = current.includes(status)
      ? current.filter((item) => item !== status)
      : [...current, status]

    updateFilter('status', updated)
  }

  const handleTeamMemberChange = (memberId: string) => {
    const current = normalizedDraftFilters.team_member || []
    const updated = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]

    updateFilter('team_member', updated)
  }

  const persistPresets = (nextPresets: SavedCastingPreset[]) => {
    localStorage.setItem(CASTING_PRESET_STORAGE_KEY, JSON.stringify(nextPresets))
    setPresets(nextPresets)
  }

  const handleSavePreset = async () => {
    const name = sanitizePresetName(presetName)
    if (!name) return

    setSavingPreset(true)
    try {
      const existingPreset = presets.find((preset) => preset.name.toLowerCase() === name.toLowerCase())
      const nextPresets = upsertCastingPreset(presets, {
        name,
        filters: normalizedDraftFilters,
      })

      persistPresets(nextPresets)
      setPresetName('')
      toast.success(existingPreset ? `Updated “${name}” preset` : `Saved “${name}” preset`)
    } finally {
      setSavingPreset(false)
    }
  }

  const applyPreset = (presetFilters: CastingFilters) => {
    const normalizedPreset = normalizeCastingFilters(presetFilters)
    setDraftFilters(normalizedPreset)
    onApply(normalizedPreset)
  }

  const handleDeletePreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId)
    const nextPresets = presets.filter((item) => item.id !== presetId)
    persistPresets(nextPresets)

    if (activePresetId === presetId) {
      onReset()
      setDraftFilters({})
    }

    toast.success(preset ? `Deleted “${preset.name}” preset` : 'Preset deleted')
  }

  const handleApply = () => {
    onApply(normalizedDraftFilters)
  }

  const handleReset = () => {
    setDraftFilters({})
    onReset()
  }

  const handleMyCastings = () => {
    if (!myCastingsFilters) {
      toast.error('Could not match the current user to a team member for My Jobs.')
      return
    }

    applyPreset(myCastingsFilters)
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Advanced filters</h3>
          <p className="text-sm text-slate-500">Apply a saved view or tune filters before updating the board.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleMyCastings}
            disabled={loadingTeam || !myCastingsFilters}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              activePresetId === 'my-jobs'
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {loadingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
            My Jobs
            {activePresetId === 'my-jobs' && <Check className="h-4 w-4" />}
          </button>

          {presets.map((preset) => (
            <div
              key={preset.id}
              className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 ${
                activePresetId === preset.id
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <button
                type="button"
                onClick={() => applyPreset(preset.filters)}
                className="inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:text-slate-900"
              >
                {preset.name}
                {activePresetId === preset.id && <Check className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => handleDeletePreset(preset.id)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500"
                aria-label={`Delete ${preset.name} preset`}
                title={`Delete ${preset.name} preset`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            {pipeline.map((stage) => (
              <label key={stage.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={normalizedDraftFilters.status?.includes(stage.name) || false}
                  onChange={() => handleStatusChange(stage.name)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm text-slate-600">{stage.name}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Source</label>
          <select
            value={normalizedDraftFilters.source?.[0] || ''}
            className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            onChange={(e) => updateFilter('source', e.target.value ? [e.target.value] : [])}
          >
            <option value="">All sources</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">From date</label>
          <input
            type="date"
            value={normalizedDraftFilters.date_from?.[0] || ''}
            className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            onChange={(e) => updateFilter('date_from', e.target.value ? [e.target.value] : [])}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">To date</label>
          <input
            type="date"
            value={normalizedDraftFilters.date_to?.[0] || ''}
            className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            onChange={(e) => updateFilter('date_to', e.target.value ? [e.target.value] : [])}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Team member</label>
          {loadingTeam ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50/50 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              {team.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={normalizedDraftFilters.team_member?.includes(String(member.id)) || false}
                    onChange={() => handleTeamMemberChange(String(member.id))}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-600">{member.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Save current filters as..."
              className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 sm:w-56"
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!sanitizePresetName(presetName) || savingPreset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPreset ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
              Save preset
            </button>
          </div>
          {hasPendingChanges && <span className="text-sm text-amber-600">You have unapplied filter changes.</span>}
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!hasPendingChanges}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            Apply filters
          </button>
        </div>
      </div>
    </div>
  )
}
