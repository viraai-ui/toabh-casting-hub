import { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Clock, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'

interface AuditEntry {
  id: number
  user_id: number | null
  user_name: string | number
  action: string
  details: string
  ip_address: string
  created_at: string
}

interface AuditLogResponseEntry {
  id: number
  user_id: number | null
  user_name: string | number
  action: string
  details: string
  ip_address: string
  created_at: string
}

interface AuditLogResponse {
  entries?: AuditLogResponseEntry[]
}

function formatRelativeTime(value?: string) {
  if (!value) return ''
  const date = new Date(value + (value.endsWith('Z') ? '' : 'Z'))
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/audit-log')
      .then((data: unknown) => {
        const payload = data as AuditLogResponse | AuditLogResponseEntry[]
        const entries = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.entries)
            ? payload.entries
            : []
        setEntries(entries)
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  const sensitiveCount = useMemo(
    () => entries.filter((entry) => {
      const action = entry.action.toLowerCase()
      return action.includes('delete') || action.includes('permission') || action.includes('password') || action.includes('invite')
    }).length,
    [entries]
  )

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  const actionColor = (action: string) => {
    const a = action.toLowerCase()
    if (a.includes('login') || a.includes('activate')) return 'text-emerald-600 bg-emerald-50'
    if (a.includes('logout') || a.includes('deactivat') || a.includes('delete')) return 'text-red-600 bg-red-50'
    if (a.includes('password') || a.includes('invite') || a.includes('permissions')) return 'text-amber-600 bg-amber-50'
    return 'text-slate-600 bg-slate-50'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Audit log</h2>
        <p className="text-sm text-slate-500">Track sensitive admin activity, permission changes, and system-level actions across the workspace.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Events loaded</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{entries.length} recent entries</p>
          <p className="mt-1 text-sm text-slate-500">Use this stream to verify recent admin-side activity and workspace changes.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Sensitive actions</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{sensitiveCount} flagged entries</p>
          <p className="mt-1 text-sm text-slate-500">Deletes, invites, passwords, and permission changes deserve the fastest review.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Audit tip</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Look for clusters of permission edits or deletes, not just single events.</p>
          <p className="mt-1 text-sm text-slate-600">That pattern is usually what surfaces mistakes or risky admin behavior fastest.</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Audit log</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">No audit entries yet</p>
          <p className="mt-2 text-sm text-slate-500">Workspace changes, permission updates, and sensitive actions will start appearing here.</p>
          <p className="mt-2 text-xs text-slate-400">Once the team is active, this becomes the accountability trail for admin decisions and system changes.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center sm:gap-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', actionColor(entry.action))}>
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{String(entry.user_name || 'System')}</span>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', actionColor(entry.action))}>
                      {entry.action}
                    </span>
                    <span className="text-xs text-slate-400 sm:hidden">{formatRelativeTime(entry.created_at)}</span>
                  </div>
                  {entry.details && <p className="mt-1 text-sm text-slate-500">{entry.details}</p>}
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs text-slate-400">{formatRelativeTime(entry.created_at)}</p>
                  {entry.ip_address && <p className="text-[10px] text-slate-300">{entry.ip_address}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
