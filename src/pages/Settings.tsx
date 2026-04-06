import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Loader2,
  Workflow,
  Radio,
  Rows3,
  ShieldCheck,
  Users,
  Mail,
  BellRing,
  LayoutDashboard,
  Tags,
} from 'lucide-react'
import { PipelineStages } from './settings/PipelineStages'
import { LeadSources } from './settings/LeadSources'
import { CustomFields } from './settings/CustomFields'
import { RolesPermissions } from './settings/RolesPermissions'
import { TeamManagement } from './settings/TeamManagement'
import { DashboardSettings } from './settings/DashboardSettings'
import { EmailAutomationHub } from './settings/EmailAutomationHub'
import { NotificationsSettings } from './settings/NotificationsSettings'
import { ClientTags } from './settings/ClientTags'
import { cn } from '@/lib/utils'
import { checkSession } from '@/lib/api'

const tabs = [
  { id: 'pipeline', label: 'Pipeline', icon: Workflow },
  { id: 'sources', label: 'Sources', icon: Radio },
  { id: 'custom-fields', label: 'Fields', icon: Rows3 },
  { id: 'client-tags', label: 'Client Tags', icon: Tags },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
] as const

export function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pipeline')
  const [isVerified, setIsVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    checkSession().then((ok: boolean) => {
      if (!cancelled) {
        setIsVerified(ok)
        setChecking(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!isVerified) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Admin Access Required</h2>
        <p className="text-slate-500 mb-6 text-sm">Please verify your identity to access settings.</p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary w-full justify-center"
        >
          Go to Login
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <aside className="rounded-[28px] border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
              <p className="mt-1 text-sm text-slate-500">Manage your workspace setup and defaults.</p>
            </div>

            <nav className="space-y-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                        active ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>
        </div>

        <div className="lg:hidden flex-shrink-0">
          <div className="overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar:hidden]">
            <div className="flex gap-1.5 px-1 pb-1 w-max min-w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all duration-150 whitespace-nowrap shrink-0',
                      activeTab === tab.id
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:pt-0">
          <div className="w-full max-w-[1040px]">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {activeTab === 'pipeline' && <PipelineStages />}
              {activeTab === 'sources' && <LeadSources />}
              {activeTab === 'custom-fields' && <CustomFields />}
              {activeTab === 'client-tags' && <ClientTags />}
              {activeTab === 'roles' && <RolesPermissions />}
              {activeTab === 'team' && <TeamManagement />}
              {activeTab === 'email' && <EmailAutomationHub />}
              {activeTab === 'notifications' && <NotificationsSettings />}
              {activeTab === 'dashboard' && <DashboardSettings />}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
