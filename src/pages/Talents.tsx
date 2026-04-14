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

export function Talents() {
  const [talents, setTalents] = useState<Talent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
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

    return [...results].sort((a, b) => {
      const key = sortConfig.key
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
  }, [talents, searchQuery, sortConfig])

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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, or Instagram..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setSelectedTalent(null)
              openDetail(null)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Talent
          </button>
        </div>
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-xs text-slate-500">
          Showing {filteredTalents.length} of {talents.length} talent{talents.length !== 1 ? 's' : ''}
        </p>
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
            <p className="text-5xl mb-3">🎭</p>
            <p className="text-sm font-medium text-slate-700">No talents yet</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'No results match your search.' : 'Add your first talent or import a CSV to get started.'}
            </p>
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
                  <th className="text-right px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTalents.map((talent) => (
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
                ))}
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
