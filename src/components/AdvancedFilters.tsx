import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { PipelineStage, TeamMember } from '@/types'

interface AdvancedFiltersProps {
  pipeline: PipelineStage[]
  filters: { [key: string]: string[] }
  onFiltersChange: (filters: { [key: string]: string[] }) => void
}

export function AdvancedFilters({ pipeline, filters, onFiltersChange }: AdvancedFiltersProps) {
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [presets, setPresets] = useState<{ name: string; filters: { [key: string]: string[] } }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('casting_filter_presets') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const data = await api.get('/team')
        setTeam(data)
      } catch (err) {
        console.error('Failed to fetch team:', err)
      } finally {
        setLoadingTeam(false)
      }
    }
    fetchTeam()
  }, [])

  const handleStatusChange = (status: string) => {
    const current = filters.status || []
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    onFiltersChange({ ...filters, status: updated })
  }

  const handleTeamMemberChange = (memberId: string) => {
    const current = filters.team_member || []
    const updated = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]
    onFiltersChange({ ...filters, team_member: updated })
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    setSavingPreset(true)
    const newPreset = { name: presetName, filters }
    const updated = [...presets.filter((p) => p.name !== presetName), newPreset]
    localStorage.setItem('casting_filter_presets', JSON.stringify(updated))
    setPresets(updated)
    setPresetName('')
    setSavingPreset(false)
  }

  const handleLoadPreset = (preset: { name: string; filters: { [key: string]: string[] } }) => {
    onFiltersChange(preset.filters)
  }

  const handleClearAll = () => {
    onFiltersChange({})
  }

  return (
    <div className="card p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {pipeline.map((stage) => (
              <label key={stage.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.status?.includes(stage.name) || false}
                  onChange={() => handleStatusChange(stage.name)}
                  className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-sm text-slate-600">{stage.name}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Source Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Source</label>
          <select
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">All sources</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value ? [e.target.value] : [] })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value ? [e.target.value] : [] })}
          />
        </div>

        {/* Team Member Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Team Member</label>
          {loadingTeam ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {team.map((member) => (
                <label key={member.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.team_member?.includes(String(member.id)) || false}
                    onChange={() => handleTeamMemberChange(String(member.id))}
                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-600">{member.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <button
          onClick={handleClearAll}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Clear All
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Preset selector */}
          {presets.length > 0 && (
            <select
              onChange={(e) => {
                const preset = presets.find((p) => p.name === e.target.value)
                if (preset) handleLoadPreset(preset)
              }}
              className="flex-1 sm:flex-none px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
            >
              <option value="">Load preset...</option>
              {presets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
          )}

          {/* Save preset */}
          <div className="flex-1 sm:flex-none flex items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="flex-1 sm:flex-none px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm w-32"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim() || savingPreset}
              className="p-2 text-slate-500 hover:text-amber-600 disabled:opacity-50"
              title="Save preset"
            >
              {savingPreset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
