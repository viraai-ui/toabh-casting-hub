import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Briefcase,
  Users,
  UserCircle,
  X,
  Loader2,
  Building2,
  Phone,
  Mail,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { useOverlay } from '@/hooks/useOverlayManager'
import type { SearchResult, Casting, Client, TeamMember } from '@/types'

const EMPTY_RESULTS: SearchResult = {
  castings: [],
  clients: [],
  team: [],
}

type SearchItem =
  | { type: 'casting'; data: Casting }
  | { type: 'client'; data: Client }
  | { type: 'team'; data: TeamMember }

const safeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const normaliseSearchResults = (payload: unknown): SearchResult => {
  const source = payload && typeof payload === 'object' ? payload as Partial<SearchResult> : {}
  return {
    castings: Array.isArray(source.castings) ? source.castings : [],
    clients: Array.isArray(source.clients) ? source.clients : [],
    team: Array.isArray(source.team) ? source.team : [],
  }
}

const getCastingSubtitle = (casting: Casting) => {
  const parts = [safeText(casting.client_name), safeText(casting.client_company), safeText(casting.client_contact), safeText(casting.status)]
    .filter(Boolean)
    .slice(0, 3)

  return parts.length > 0 ? parts.join(' • ') : 'Casting'
}

const getClientSubtitle = (client: Client) => {
  const parts = [safeText(client.company), safeText(client.phone), safeText(client.email)].filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : 'Client'
}

const getTeamSubtitle = (member: TeamMember) => {
  const parts = [safeText(member.role), safeText(member.email), safeText(member.phone)].filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : 'Team member'
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const { setSearchOpen } = useAppStore()
  const { openOverlay, closeOverlay } = useOverlay()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches')
      if (saved) {
        const parsed = JSON.parse(saved)
        setRecentSearches(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
      }
    } catch {
      setRecentSearches([])
    }
  }, [])

  const saveSearch = (q: string) => {
    const next = q.trim()
    if (!next) return

    const updated = [next, ...recentSearches.filter((item) => item !== next)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recent_searches', JSON.stringify(updated))
  }

  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut)
    return () => window.removeEventListener('keydown', handleGlobalShortcut)
  }, [setSearchOpen])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    openOverlay('global-search', () => setSearchOpen(false))
    return () => closeOverlay('global-search')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runSearch = useCallback((rawQuery: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    const nextQuery = rawQuery.trim()
    if (!nextQuery) {
      setLoading(false)
      setResults(EMPTY_RESULTS)
      setSelectedIndex(0)
      return
    }

    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const response = await api.get(`/search?q=${encodeURIComponent(nextQuery)}`)
        const normalized = normaliseSearchResults(response)
        setResults(normalized)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Search error:', err)
        setResults(EMPTY_RESULTS)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  useEffect(() => {
    runSearch(query)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  const allResults = useMemo<SearchItem[]>(() => {
    return [
      ...results.castings.slice(0, 6).map((casting) => ({ type: 'casting' as const, data: casting })),
      ...results.clients.slice(0, 4).map((client) => ({ type: 'client' as const, data: client })),
      ...results.team.slice(0, 3).map((member) => ({ type: 'team' as const, data: member })),
    ]
  }, [results])

  const closeSearch = () => setSearchOpen(false)

  const openResult = (item: SearchItem) => {
    saveSearch(query)

    if (item.type === 'casting') navigate(`/castings?id=${item.data.id}`)
    if (item.type === 'client') navigate(`/clients?id=${item.data.id}`)
    if (item.type === 'team') navigate(`/team?id=${item.data.id}`)

    closeSearch()
  }

  const handleSelectRecent = (value: string) => {
    setQuery(value)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeSearch()
      return
    }

    if (!allResults.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, allResults.length - 1))
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    }

    if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault()
      openResult(allResults[selectedIndex])
    }
  }

  const hasResults = allResults.length > 0

  const renderSectionHeader = (label: string) => (
    <div className="px-3 pb-2 pt-4 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    </div>
  )

  let currentIndex = 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeSearch}
        className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md px-3 pt-[max(4rem,8vh)] sm:px-4"
      >
        <motion.div
          initial={{ y: 16, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.45)]"
        >
          <div className="border-b border-slate-200/80 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Universal search</p>
                <p className="text-xs text-slate-500">Search castings, clients, phone numbers, emails, and team.</p>
              </div>
              <button
                onClick={closeSearch}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              ) : (
                <Search className="h-5 w-5 text-slate-400" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search project, client, phone, email..."
                className="h-7 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-lg"
              />
              <div className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-400 sm:flex">
                <kbd className="font-medium text-slate-500">⌘K</kbd>
              </div>
            </div>
          </div>

          <div className="max-h-[min(68vh,560px)] overflow-y-auto px-3 pb-3 pt-2 sm:px-4">
            {!query && recentSearches.length > 0 && (
              <div className="rounded-2xl bg-slate-50/80 p-2">
                {renderSectionHeader('Recent')}
                <div className="space-y-1">
                  {recentSearches.map((item, index) => (
                    <button
                      key={`${item}-${index}`}
                      onClick={() => handleSelectRecent(item)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white"
                    >
                      <Search className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!query && recentSearches.length === 0 && (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Search everything instantly</p>
                  <p className="mt-1 text-sm text-slate-500">Find castings, clients, phone numbers, emails, and team members in one place.</p>
                </div>
              </div>
            )}

            {query && !loading && !hasResults && (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">No matches found</p>
                  <p className="mt-1 text-sm text-slate-500">Try a project name, client, phone number, or email.</p>
                </div>
              </div>
            )}

            {hasResults && (
              <div className="space-y-4 pb-1">
                {results.castings.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/65 p-2">
                    {renderSectionHeader('Castings')}
                    <div className="space-y-1">
                      {results.castings.slice(0, 6).map((casting) => {
                        const rowIndex = currentIndex++
                        const active = selectedIndex === rowIndex
                        return (
                          <button
                            key={`casting-${casting.id}`}
                            onClick={() => openResult({ type: 'casting', data: casting })}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all',
                              active ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-white'
                            )}
                          >
                            <div className={cn('mt-0.5 rounded-2xl p-2', active ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400')}>
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{safeText(casting.project_name) || 'Untitled project'}</p>
                              <p className="mt-0.5 text-sm text-slate-500">{getCastingSubtitle(casting)}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {results.clients.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/65 p-2">
                    {renderSectionHeader('Clients')}
                    <div className="space-y-1">
                      {results.clients.slice(0, 4).map((client) => {
                        const rowIndex = currentIndex++
                        const active = selectedIndex === rowIndex
                        return (
                          <button
                            key={`client-${client.id}`}
                            onClick={() => openResult({ type: 'client', data: client })}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all',
                              active ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-white'
                            )}
                          >
                            <div className={cn('mt-0.5 rounded-2xl p-2', active ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400')}>
                              <Users className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{safeText(client.name) || 'Unnamed client'}</p>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                {safeText(client.company) && (
                                  <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{safeText(client.company)}</span>
                                )}
                                {safeText(client.phone) && (
                                  <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{safeText(client.phone)}</span>
                                )}
                                {safeText(client.email) && (
                                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{safeText(client.email)}</span>
                                )}
                              </div>
                              {!safeText(client.company) && !safeText(client.phone) && !safeText(client.email) && (
                                <p className="mt-0.5 text-sm text-slate-500">{getClientSubtitle(client)}</p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {results.team.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/65 p-2">
                    {renderSectionHeader('Team')}
                    <div className="space-y-1">
                      {results.team.slice(0, 3).map((member) => {
                        const rowIndex = currentIndex++
                        const active = selectedIndex === rowIndex
                        return (
                          <button
                            key={`team-${member.id}`}
                            onClick={() => openResult({ type: 'team', data: member })}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all',
                              active ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-white'
                            )}
                          >
                            <div className={cn('mt-0.5 rounded-2xl p-2', active ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400')}>
                              <UserCircle className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{safeText(member.name) || 'Unnamed team member'}</p>
                              <p className="mt-0.5 text-sm text-slate-500">{getTeamSubtitle(member)}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/80 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 sm:text-xs">
              <span className="inline-flex items-center gap-1.5"><kbd className="rounded-md bg-white px-1.5 py-0.5 font-medium text-slate-600 shadow-sm">↑↓</kbd>Move</span>
              <span className="inline-flex items-center gap-1.5"><kbd className="rounded-md bg-white px-1.5 py-0.5 font-medium text-slate-600 shadow-sm">Enter</kbd>Open</span>
              <span className="inline-flex items-center gap-1.5"><kbd className="rounded-md bg-white px-1.5 py-0.5 font-medium text-slate-600 shadow-sm">Esc</kbd>Close</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
