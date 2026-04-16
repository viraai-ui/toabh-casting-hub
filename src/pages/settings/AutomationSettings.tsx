import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, BellRing, Mail, Loader2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AutomationRule {
  id: string
  label: string
  description: string
  channels: string[]
  enabled: boolean
}

interface AutomationRulesResponse {
  rules?: AutomationRule[]
}

export function AutomationSettings() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.get('/settings/automation-rules')
      .then((data: unknown) => {
        const payload = data as AutomationRulesResponse
        setRules(Array.isArray(payload?.rules) ? payload.rules : [])
      })
      .catch(() => setRules([]))
      .finally(() => setLoading(false))
  }, [])

  const enabledCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules])
  const emailCapableCount = useMemo(() => rules.filter((rule) => rule.channels.includes('email')).length, [rules])

  const toggleRule = (id: string) => {
    setRules((current) => current.map((rule) => (
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    )))
  }

  const saveRules = async () => {
    setSaving(true)
    try {
      await api.put('/settings/automation-rules', { rules })
      setMessage('Automation settings saved.')
      setTimeout(() => setMessage(null), 2500)
    } catch {
      setMessage('Could not save automation settings.')
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Automation readiness</h2>
          <p className="text-sm text-slate-500">Store the triggers now so Phase 5 automations can connect without reshaping the admin UI later.</p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-auto">
          {message && (
            <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
              {message}
            </div>
          )}
          <button onClick={saveRules} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save automation settings'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Rules tracked</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{rules.length} automation rule{rules.length === 1 ? '' : 's'}</p>
          <p className="mt-1 text-sm text-slate-500">These are the trigger points available for future workflow orchestration.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enabled now</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{enabledCount} live, {Math.max(rules.length - enabledCount, 0)} paused</p>
          <p className="mt-1 text-sm text-slate-500">Pause lower-priority triggers until the team is ready for more notifications.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Phase note</p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{emailCapableCount} rules already support email delivery for later workflow handoffs.</p>
          <p className="mt-1 text-sm text-slate-600">That gives TOABH a cleaner bridge from Phase 4 UI into Phase 5 automation.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Phase foundation already in place</p>
            <p className="mt-1 text-sm text-slate-500">These triggers are stored now so workflow automation can plug in cleanly during Phase 5 without reworking the admin structure.</p>
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
            <Bot className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-900">No automation rules yet</h3>
            <p className="mt-2 text-sm text-slate-500">Once automation rules exist, this page will become the readiness board for delivery logic and workflow triggers.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{rule.label}</p>
                      <span className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium',
                        rule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      )}>
                        {rule.enabled ? 'Enabled' : 'Paused'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{rule.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rule.channels.includes('in_app') && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          <BellRing className="h-3.5 w-3.5" />
                          In-app
                        </span>
                      )}
                      {rule.channels.includes('email') && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        <Bot className="h-3.5 w-3.5" />
                        Phase 5 ready
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    onClick={() => toggleRule(rule.id)}
                    className={cn(
                      'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors',
                      rule.enabled ? 'bg-amber-500' : 'bg-slate-200'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform',
                        rule.enabled ? 'translate-x-7' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
