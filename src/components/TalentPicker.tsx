import { useState, useEffect, useRef } from 'react'
import { X, UserPlus, Search, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { getInitials } from '@/lib/utils'
import type { Talent } from '@/types'

interface TalentPickerProps {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function TalentPicker({ selectedIds, onChange, disabled = false }: TalentPickerProps) {
  const [talents, setTalents] = useState<Talent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Fetch all talents on mount
  useEffect(() => {
    let active = true
    void api.get('/talents')
      .then((data) => {
        if (active) {
          setTalents(Array.isArray(data) ? data : [])
        }
      })
      .catch(console.error)
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = search.trim()
    ? talents.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.phone || '').toLowerCase().includes(search.toLowerCase()) ||
          (t.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (t.instagram_handle || '').toLowerCase().includes(search.toLowerCase())
      )
    : talents.slice(0, 8)

  const available = filtered.filter((t) => !selectedIds.includes(t.id))

  const addTalent = (id: number) => {
    onChange([...selectedIds, id])
    setSearch('')
    setDropdownOpen(false)
  }

  const removeTalent = (id: number) => {
    onChange(selectedIds.filter((i) => i !== id))
  }

  const selectedTalents = talents.filter((t) => selectedIds.includes(t.id))

  return (
    <div ref={wrapperRef} className="space-y-2">
      <label className="text-xs font-medium text-slate-500 block">Linked Talents</label>

      {/* Selected chips */}
      {selectedTalents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTalents.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-medium"
            >
              <span className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[9px] font-bold text-amber-700">
                {getInitials(t.name)}
              </span>
              {t.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTalent(t.id)}
                  className="ml-0.5 text-amber-400 hover:text-amber-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search + add */}
      {!disabled && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Search talents..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
          />
        </div>
      )}

      {/* Dropdown */}
      {dropdownOpen && !disabled && !loading && available.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {available.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => addTalent(t.id)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-amber-700">{getInitials(t.name)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                {(t.phone || t.email) && (
                  <p className="text-[11px] text-slate-500 truncate">
                    {t.phone}{t.phone && t.email ? ' · ' : ''}{t.email}
                  </p>
                )}
              </div>
              <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {dropdownOpen && !disabled && !loading && available.length === 0 && search.trim() && (
        <div className="px-3 py-2 text-xs text-slate-400">No matching talents found</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading talents...
        </div>
      )}
    </div>
  )
}
