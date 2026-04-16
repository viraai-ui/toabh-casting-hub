import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, Clock } from 'lucide-react'
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-amber-500 animate-spin" /></div>
  }

  const actionColor = (action: string) => {
    const a = action.toLowerCase()
    if (a.includes('login') || a.includes('activate')) return 'text-emerald-600 bg-emerald-50'
    if (a.includes('logout') || a.includes('deactivat') || a.includes('delete')) return 'text-red-600 bg-red-50'
    if (a.includes('password') || a.includes('invite') || a.includes('permissions')) return 'text-amber-600 bg-amber-50'
    return 'text-slate-600 bg-slate-50'
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">Audit Log</h2>
        <p className="text-sm text-slate-500">Recent system activity and user actions.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Audit log</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">No audit entries yet</p>
          <p className="mt-2 text-sm text-slate-500">Workspace changes, permission updates, and sensitive actions will start appearing here.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <div className={cn('shrink-0 rounded-full w-9 h-9 flex items-center justify-center', actionColor(entry.action))}>
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{String(entry.user_name || 'System')}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider', actionColor(entry.action))}>
                      {entry.action}
                    </span>
                  </div>
                  {entry.details && <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.details}</p>}
                </div>
                <div className="shrink-0 text-right hidden sm:block">
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
