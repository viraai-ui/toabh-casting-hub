import { useEffect, useState } from 'react'
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
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Automation readiness</h2>
          <p className="text-sm text-slate-500">Phase 5-ready triggers for in-app alerts and future email workflows.</p>
        </div>
        {message && (
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
            {message}
          </div>
        )}
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
            <p className="text-sm font-semibold text-slate-900">Phase 3 foundation</p>
            <p className="mt-1 text-sm text-slate-500">These triggers are stored now so workflow automation can plug in cleanly during Phase 5 without reworking the UI.</p>
          </div>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{rule.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{rule.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
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

        <div className="mt-5 flex justify-end">
          <button onClick={saveRules} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Automation Settings'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
