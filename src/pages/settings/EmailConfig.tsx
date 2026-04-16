import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Mail, Send, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface EmailConfigState {
  smtp_host: string
  smtp_port: string
  smtp_username: string
  smtp_password: string
  from_address: string
  from_name: string
}

interface EmailConfigResponse {
  smtp_host?: string
  smtp_port?: string | number
  smtp_username?: string
  smtp_password?: string
  from_address?: string
  from_email?: string
  from_name?: string
}

interface ErrorWithMessage {
  message?: string
}

const EMPTY_FORM: EmailConfigState = {
  smtp_host: '',
  smtp_port: '587',
  smtp_username: '',
  smtp_password: '',
  from_address: '',
  from_name: '',
}

export function EmailConfig() {
  const [form, setForm] = useState<EmailConfigState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [feedback, setFeedback] = useState<{msg: string; type: 'success'|'error'} | null>(null)

  useEffect(() => {
    api.get('/settings/email-config')
      .then((data: unknown) => {
        const payload = (data as EmailConfigResponse) || {}
        setForm({
          smtp_host: payload.smtp_host ?? '',
          smtp_port: String(payload.smtp_port ?? '587'),
          smtp_username: payload.smtp_username ?? '',
          smtp_password: payload.smtp_password ?? '',
          from_address: payload.from_address ?? payload.from_email ?? '',
          from_name: payload.from_name ?? '',
        })
      })
      .catch(() => setForm(EMPTY_FORM))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(t)
  }, [feedback])

  const configurationState = useMemo(() => {
    const filledFields = [form.smtp_host, form.smtp_username, form.from_address, form.from_name].filter(Boolean).length
    if (filledFields === 0) return 'Not configured'
    if (filledFields < 4) return 'Partially configured'
    return 'Ready for testing'
  }, [form])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/settings/email-config', {
        ...form,
        from_email: form.from_address,
      })
      setFeedback({ msg: 'Email settings saved.', type: 'success' })
    } catch {
      setFeedback({ msg: 'Failed to save email settings.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await api.post('/settings/email-config/test', {
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_username: form.smtp_username,
        smtp_password: form.smtp_password,
        from_address: form.from_address,
        from_email: form.from_address,
      }) as { success?: boolean; message?: string }
      setFeedback({
        msg: res?.message || 'Connection tested!',
        type: res?.success ? 'success' : 'error',
      })
    } catch (err: unknown) {
      const error = err as ErrorWithMessage
      setFeedback({
        msg: error?.message || 'Test failed, check your SMTP settings.',
        type: 'error',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">SMTP and email delivery</h2>
          <p className="text-sm text-slate-500">Configure the mailbox used for workflow alerts, assignment handoffs, and future automations.</p>
        </div>
        {feedback && (
          <div className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium',
            feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}>
            {feedback.msg}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Mail className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Config state</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{configurationState}</p>
          <p className="mt-1 text-sm text-slate-500">A complete mailbox setup is needed before email alerts can leave the workspace.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Delivery identity</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{form.from_name || 'Add a sender name'}</p>
          <p className="mt-1 text-sm text-slate-500">This is the operator-facing identity recipients will see in outbound emails.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Best practice</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Use a dedicated TOABH mailbox instead of a personal inbox.</p>
          <p className="mt-1 text-sm text-slate-600">It keeps automation clean and reduces future sender-auth headaches.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card space-y-4 p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">SMTP host</label>
            <input
              type="text"
              value={form.smtp_host}
              onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">SMTP port</label>
            <input
              type="text"
              value={form.smtp_port}
              onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
              placeholder="587"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
            <input
              type="text"
              value={form.smtp_username}
              onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={form.smtp_password}
              onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">From address</label>
            <input
              type="email"
              value={form.from_address}
              onChange={(e) => setForm({ ...form, from_address: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">From name</label>
            <input
              type="text"
              value={form.from_name}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              placeholder="TOABH Casting Hub"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This mailbox powers future workflow alerts for mentions, attachments, status changes, and assignment handoffs.
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn-secondary flex items-center gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {testing ? 'Testing...' : 'Test connection'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
