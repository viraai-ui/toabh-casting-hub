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
  FolderKanban,
  CornerDownLeft,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import { useOverlay } from '@/hooks/useOverlayManager'
import type { SearchResult, SearchProjectResult, Casting, Client, TeamMember } from '@/types'

const EMPTY_RESULTS: SearchResult = {
  projects: [],
  castings: [],
  clients: [],
  team: [],
}

type SearchItem =
  | { type: 'project'; data: SearchProjectResult }
  | { type: 'casting'; data: Casting }
  | { type: 'client'; data: Client }
  | { type: 'team'; data: TeamMember }

const safeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const normaliseSearchResults = (payload: unknown): SearchResult => {
  const source = payload && typeof payload === 'object' ? payload as Partial<SearchResult> : {}
  return {
    projects: Array.isArray(source.projects) ? source.projects : [],
    castings: Array.isArray(source.castings) ? source.castings : [],
    clients: Array.isArray(source.clients) ? source.clients : [],
    team: Array.isArray(source.team) ? source.team : [],
  }
}

const getProjectSubtitle = (project: SearchProjectResult) => {
  const parts = [safeText(project.client_name), safeText(project.status), safeText(project.project_type)].filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : 'Project'
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
      ...results.projects.slice(0, 3).map((project) => ({ type: 'project' as const, data: project })),
      ...results.castings.slice(0, 6).map((casting) => ({ type: 'casting' as const, data: casting })),
      ...results.clients.slice(0, 4).map((client) => ({ type: 'client' as const, data: client })),
      ...results.team.slice(0, 3).map((member) => ({ type: 'team' as const, data: member })),
    ]
  }, [results])

  const closeSearch = () => setSearchOpen(false)

  const openResult = (item: SearchItem) => {
    saveSearch(query)

    if (item.type === 'project') navigate(`/castings?id=${item.data.id}`)
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

  const resultSummary = useMemo(() => {
    if (!query.trim()) return 'Search jobs, clients, team members, and live records.'
    const counts = [
      results.projects.length ? `${results.projects.length} projects` : '',
      results.castings.length ? `${results.castings.length} castings` : '',
      results.clients.length ? `${results.clients.length} clients` : '',
      results.team.length ? `${results.team.length} team` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(' • ') : 'No matches yet'
  }, [query, results])

  const renderSectionHeader = (label: string, count?: number) => (
    <div className="flex items-center justify-between px-3 pb-2 pt-4 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      {typeof count === 'number' && count > 0 && <span className="text-[11px] font-medium text-slate-400">{count}</span>}
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
          className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/98 shadow-[0_32px_90px_-30px_rgba(15,23,42,0.42)] ring-1 ring-slate-950/5"
        >
          <div className="border-b border-slate-200/60 px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">Universal search</p>
                <p className="mt-1 text-xs text-slate-500">Jump into jobs, clients, team, phone numbers, and live records.</p>
              </div>
              <div className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 sm:inline-flex">
                Command surface
              </div>
              <button
                onClick={closeSearch}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
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
                placeholder="Search project, job, client, team, phone, or email..."
                className="h-7 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-lg"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-5 text-slate-600">
              Search is designed for quick routing, use names, clients, phone numbers, or email fragments to jump straight into active records.
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-500">
              <p>{resultSummary}</p>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                  <CornerDownLeft className="h-3.5 w-3.5" /> Open
                </span>
                <span className="inline-flex rounded-full bg-white px-2 py-1">↑↓ Navigate</span>
                <span className="inline-flex rounded-full bg-white px-2 py-1">Esc Close</span>
              </div>
            </div>
          </div>

          <div className="max-h-[min(68vh,560px)] overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
            {!query && recentSearches.length > 0 && (
              <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-2.5 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.28)]">
                {renderSectionHeader('Recent', recentSearches.length)}
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
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-slate-200/90 bg-slate-50/75 px-8 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)]">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div className="max-w-sm">
                  <p className="text-base font-semibold tracking-tight text-slate-900">Search everything instantly</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">Find projects, jobs, clients, phone numbers, emails, and team members in one place.</p>
                  <p className="mt-2 text-xs text-slate-400">Start typing to turn this into the fastest navigation layer in the workspace.</p>
                </div>
              </div>
            )}

            {query && !loading && !hasResults && (
              <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-slate-200/90 bg-slate-50/75 px-8 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)]">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <div className="max-w-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Global search</p>
                  <p className="mt-3 text-base font-semibold tracking-tight text-slate-900">No matches found</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">Try a project name, client, phone number, email, or team member.</p>
                  <p className="mt-2 text-xs text-slate-400">Search gets more useful as castings, talent, and client relationships keep filling in.</p>
                </div>
              </div>
            )}

            {hasResults && (
              <div className="space-y-4">
                {results.projects.length > 0 && (
                  <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-2.5 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.28)]">
                    {renderSectionHeader('Projects', results.projects.length)}
                    <div className="space-y-1">
                      {results.projects.slice(0, 3).map((project) => {
                        const rowIndex = currentIndex++
                        const active = selectedIndex === rowIndex
                        return (
                          <button
                            key={`project-${project.id}`}
                            onClick={() => openResult({ type: 'project', data: project })}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all',
                              active ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-white'
                            )}
                          >
                            <div className={cn('mt-0.5 rounded-2xl p-2', active ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400')}>
                              <FolderKanban className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{safeText(project.project_name) || 'Untitled project'}</p>
                              <p className="mt-0.5 text-sm text-slate-500">{getProjectSubtitle(project)}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {results.castings.length > 0 && (
                  <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-2.5 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.28)]">
                    {renderSectionHeader('Castings', results.castings.length)}
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
                  <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-2.5 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.28)]">
                    {renderSectionHeader('Clients', results.clients.length)}
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
                  <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-2.5 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.28)]">
                    {renderSectionHeader('Team', results.team.length)}
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
