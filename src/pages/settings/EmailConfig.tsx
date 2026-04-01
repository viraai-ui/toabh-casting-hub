import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function EmailConfig() {
  const [form, setForm] = useState({
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    from_address: '',
    from_name: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [feedback, setFeedback] = useState<{msg: string; type: 'success'|'error'} | null>(null)

  useEffect(() => {
    api.get('/settings/email-config')
      .then((data: any) => setForm(data))
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(t)
  }, [feedback])

  const handleSave = async () => {
    const snapshot = { ...form }
    setSaving(true)
    try {
      await api.put('/settings/email-config', form)
      setFeedback({ msg: 'Email settings saved!', type: 'success' })
    } catch {
      setForm(snapshot)
      setFeedback({ msg: 'Failed to save email settings', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      await api.post('/settings/email-config/test', form)
      setFeedback({ msg: 'Test email sent! (or SMTP not configured)', type: 'success' })
    } catch {
      setFeedback({ msg: 'Test failed — check your SMTP settings', type: 'error' })
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Email Configuration</h2>
          <p className="text-sm text-slate-500">Configure SMTP settings for outgoing emails</p>
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
        <div className="grid grid-cols-2 gap-4">
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
              placeholder="TOABH Casting Hub"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
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
