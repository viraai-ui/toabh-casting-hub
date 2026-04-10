import { useEffect, useMemo, useState } from 'react'
import { BellRing, Loader2, Mail } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface NotificationRule {
  id: string
  label: string
  description: string
  channels: string[]
  enabled?: boolean
}

interface NotificationRulesResponse {
  rules?: NotificationRule[]
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
        checked ? 'bg-amber-500' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

export function NotificationsSettings() {
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.get('/settings/automation-rules')
      .then((data: unknown) => {
        const payload = data as NotificationRulesResponse
        setRules(Array.isArray(payload?.rules) ? payload.rules : [])
      })
      .catch(() => setRules([]))
      .finally(() => setLoading(false))
  }, [])

  const normalizedRules = useMemo(() => {
    return rules.map((rule) => ({
      ...rule,
      channels: Array.isArray(rule.channels) ? rule.channels : [],
    }))
  }, [rules])

  const toggleChannel = (id: string, channel: 'in_app' | 'email') => {
    setRules((current) => current.map((rule) => {
      if (rule.id !== id) return rule
      const channels = new Set(Array.isArray(rule.channels) ? rule.channels : [])
      if (channels.has(channel)) {
        channels.delete(channel)
      } else {
        channels.add(channel)
      }
      const nextChannels = Array.from(channels)
      return {
        ...rule,
        channels: nextChannels,
        enabled: nextChannels.length > 0,
      }
    }))
  }

  const saveRules = async () => {
    setSaving(true)
    try {
      const payload = normalizedRules.map((rule) => ({
        ...rule,
        enabled: rule.channels.length > 0,
      }))
      await api.put('/settings/automation-rules', { rules: payload })
      setMessage('Notification settings saved.')
      setTimeout(() => setMessage(null), 2500)
    } catch {
      setMessage('Could not save notification settings.')
      setTimeout(() => setMessage(null), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
          <p className="text-sm text-slate-500">Choose how you want to receive updates across the workspace.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {message && (
            <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
              {message}
            </div>
          )}
          <button onClick={saveRules} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Notification Settings'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {normalizedRules.map((rule) => {
          const hasInApp = rule.channels.includes('in_app')
          const hasEmail = rule.channels.includes('email')

          return (
            <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{rule.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{rule.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:justify-end">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">In-app</span>
                    <Toggle
                      checked={hasInApp}
                      onChange={() => toggleChannel(rule.id, 'in_app')}
                      label={`${rule.label} in-app notifications`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">Email</span>
                    <Toggle
                      checked={hasEmail}
                      onChange={() => toggleChannel(rule.id, 'email')}
                      label={`${rule.label} email notifications`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
