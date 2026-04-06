import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Send } from 'lucide-react'
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
      .then((data: any) => {
        setForm({
          smtp_host: data?.smtp_host ?? '',
          smtp_port: String(data?.smtp_port ?? '587'),
          smtp_username: data?.smtp_username ?? '',
          smtp_password: data?.smtp_password ?? '',
          from_address: data?.from_address ?? data?.from_email ?? '',
          from_name: data?.from_name ?? '',
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/settings/email-config', {
        ...form,
        from_email: form.from_address,
      })
      setFeedback({ msg: 'Email settings saved!', type: 'success' })
    } catch {
      setFeedback({ msg: 'Failed to save email settings', type: 'error' })
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
        type: res?.success ? 'success' : 'error'
      })
    } catch (err: any) {
      setFeedback({
        msg: err?.message || 'Test failed — check your SMTP settings',
        type: 'error'
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">SMTP + email delivery</h2>
          <p className="text-sm text-slate-500">Configure the mailbox used for Phase 3 alerts and future automations.</p>
        </div>
        {feedback && (
          <div className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium',
            feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}>
            {feedback.msg}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">SMTP Host</label>
            <input
              type="text"
              value={form.smtp_host}
              onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">SMTP Port</label>
            <input
              type="text"
              value={form.smtp_port}
              onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
              placeholder="587"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              type="text"
              value={form.smtp_username}
              onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              value={form.smtp_password}
              onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">From Address</label>
            <input
              type="email"
              value={form.from_address}
              onChange={(e) => setForm({ ...form, from_address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">From Name</label>
            <input
              type="text"
              value={form.from_name}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              placeholder="TOABH Jobs Hub"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This powers future workflow alerts for mentions, attachments, status changes, and assignment handoffs.
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn-secondary flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Test Connection
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
