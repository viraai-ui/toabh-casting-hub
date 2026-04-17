import { Mail, Sparkles, Wand2 } from 'lucide-react'
import { EmailConfig } from './EmailConfig'
import { EmailTemplates } from './EmailTemplates'
import { AutomationSettings } from './AutomationSettings'

export function EmailAutomationHub() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Mail className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Email hub</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">Delivery, templates, and automation in one place</p>
          <p className="mt-1 text-sm text-slate-500">This tab now acts like an operating surface instead of a single subpage.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Wand2 className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Workflow bridge</p>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">Templates connect cleanly into future automations</p>
          <p className="mt-1 text-sm text-slate-500">Operators can configure messaging here before Phase 5 workflow logic lands.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Recommended flow</p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">Set SMTP first, then write templates, then enable automation triggers.</p>
          <p className="mt-1 text-sm text-slate-600">That sequence keeps outbound email setup much less error-prone.</p>
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">1. Delivery setup</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Mailbox and sender identity</h3>
        </div>
        <EmailConfig />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">2. Reusable messaging</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Email templates</h3>
        </div>
        <EmailTemplates />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">3. Automation readiness</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Trigger configuration</h3>
        </div>
        <AutomationSettings />
      </section>
    </div>
  )
}
