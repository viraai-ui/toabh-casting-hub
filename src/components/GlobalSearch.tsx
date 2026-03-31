import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Briefcase, Users, UserCircle, X, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import type { SearchResult } from '@/types'

export function GlobalSearch() {
  const navigate = useNavigate()
  const { setSearchOpen } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches')
      if (saved) setRecentSearches(JSON.parse(saved))
    } catch {}
  }, [])

  const saveSearch = (q: string) => {
    if (!q.trim()) return
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recent_searches', JSON.stringify(updated))
  }

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSearchOpen])

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults(null)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(q)}`)
        setResults(data)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const handleSelectRecent = (q: string) => {
    setQuery(q)
    search(q)
  }

  useEffect(() => {
    search(query)
  }, [query, search])

  // Flatten results for keyboard nav
  const allResults = results ? [
    ...results.castings.slice(0, 5).map(c => ({ type: 'casting' as const, data: c })),
    ...results.clients.slice(0, 3).map(c => ({ type: 'client' as const, data: c })),
    ...results.team.slice(0, 2).map(t => ({ type: 'team' as const, data: t })),
  ] : []

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      const item = allResults[selectedIndex]
      saveSearch(query)
      if (item.type === 'casting') navigate(`/castings?id=${item.data.id}`)
      else if (item.type === 'client') navigate(`/clients?id=${item.data.id}`)
      else if (item.type === 'team') navigate(`/team?id=${item.data.id}`)
      setSearchOpen(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setSearchOpen(false)}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-xl mx-4 glass rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
            {loading ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-slate-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search castings, clients, team..."
              className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 outline-none text-lg"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!query && recentSearches.length > 0 && (
              <div>
                <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Recent Searches
                </p>
                {recentSearches.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectRecent(q)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-slate-50"
                  >
                    <Search className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{q}</span>
                  </button>
                ))}
              </div>
            )}
            {!query && recentSearches.length === 0 && (
              <p className="text-center text-slate-400 py-8">
                Type to search...
              </p>
            )}
            
            {query && results && allResults.length === 0 && !loading && (
              <p className="text-center text-slate-400 py-8">
                No results found
              </p>
            )}

            {results && results.castings.length > 0 && (
              <div className="mb-2">
                <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Castings
                </p>
                {results.castings.slice(0, 5).map((casting, i) => {
                  const idx = i
                  return (
                    <button
                      key={casting.id}
                      onClick={() => {
                        saveSearch(query)
                        navigate(`/castings?id=${casting.id}`)
                        setSearchOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                        selectedIndex === idx ? 'bg-amber-500/10 text-amber-600' : 'hover:bg-slate-50'
                      )}
                    >
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-900">{casting.project_name || 'Untitled'}</p>
                        <p className="text-sm text-slate-500">{casting.client_name} • {casting.status}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {results && results.clients.length > 0 && (
              <div className="mb-2">
                <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Clients
                </p>
                {results.clients.slice(0, 3).map((client, i) => {
                  const idx = results.castings.slice(0, 5).length + i
                  return (
                    <button
                      key={client.id}
                      onClick={() => {
                        saveSearch(query)
                        navigate(`/clients?id=${client.id}`)
                        setSearchOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                        selectedIndex === idx ? 'bg-amber-500/10 text-amber-600' : 'hover:bg-slate-50'
                      )}
                    >
                      <Users className="w-4 h-4 text-slate-400" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-900">{client.name}</p>
                        <p className="text-sm text-slate-500">{client.company || client.email}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {results && results.team.length > 0 && (
              <div>
                <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Team
                </p>
                {results.team.slice(0, 2).map((member, i) => {
                  const idx = results.castings.slice(0, 5).length + results.clients.slice(0, 3).length + i
                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        saveSearch(query)
                        navigate(`/team?id=${member.id}`)
                        setSearchOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                        selectedIndex === idx ? 'bg-amber-500/10 text-amber-600' : 'hover:bg-slate-50'
                      )}
                    >
                      <UserCircle className="w-4 h-4 text-slate-400" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-900">{member.name}</p>
                        <p className="text-sm text-slate-500">{member.role}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-3 border-t border-white/10 bg-slate-50/50">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Enter</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Esc</kbd>
                Close
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
