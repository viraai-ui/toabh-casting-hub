import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  BellRing,
  LayoutDashboard,
  Loader2,
  Mail,
  Radio,
  Rows3,
  Shield,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
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
import { PermissionsEditor } from './settings/PermissionsEditor'
import { AuditLogViewer } from './settings/AuditLogViewer'
import { cn } from '@/lib/utils'
import { checkSession, getSessionUser, isAdminUser } from '@/lib/api'

const tabs = [
  { id: 'pipeline', label: 'Pipeline', icon: Workflow, group: 'Workflow' },
  { id: 'sources', label: 'Sources', icon: Radio, group: 'Workflow' },
  { id: 'custom-fields', label: 'Fields', icon: Rows3, group: 'Data model' },
  { id: 'client-tags', label: 'Client Tags', icon: Tags, group: 'Data model' },
  { id: 'permissions', label: 'Roles & Permissions', icon: Shield, group: 'Access' },
  { id: 'audit-log', label: 'Audit Log', icon: Activity, group: 'Access' },
  { id: 'roles', label: 'Roles', icon: ShieldCheck, group: 'Access' },
  { id: 'team', label: 'Team', icon: Users, group: 'People' },
  { id: 'email', label: 'Email', icon: Mail, group: 'Comms' },
  { id: 'notifications', label: 'Notifications', icon: BellRing, group: 'Comms' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Workspace' },
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
        setIsVerified(ok && isAdminUser(getSessionUser()))
        setChecking(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab)
  const groupCount = useMemo(() => new Set(tabs.map((tab) => tab.group)).size, [])

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!isVerified) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Admin Access Required</h2>
        <p className="mb-6 text-sm text-slate-500">Only administrator accounts can access workspace settings.</p>
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
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Settings
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              Admin controls, organized like a real operating surface.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Phase 4 turns settings into a clearer control layer for workflow, team setup, access, communications, and workspace defaults.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active section</div>
              <div className="mt-1 font-medium text-slate-800">{activeTabMeta?.label || 'Settings'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Coverage</div>
              <div className="mt-1 font-medium text-slate-800">{tabs.length} areas across {groupCount} control groups</div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <aside className="rounded-[28px] border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
              <p className="mt-1 text-sm text-slate-500">Manage workflow, data structure, access, team setup, and workspace defaults.</p>
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
                    <div className="min-w-0">
                      <div>{tab.label}</div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{tab.group}</div>
                    </div>
                  </button>
                )
              })}
            </nav>
          </aside>
        </div>

        <div className="flex-shrink-0 lg:hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{tabs.length} settings areas</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{groupCount} control groups</span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200">Active: {activeTabMeta?.label || 'Settings'}</span>
          </div>
          <div className="overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar:hidden]">
            <div className="flex min-w-full w-max gap-1.5 px-1 pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold capitalize transition-all duration-150 sm:text-sm',
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
          <div className="mb-4 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current settings area</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{activeTabMeta?.label || 'Settings'}</p>
                <p className="mt-1 text-sm text-slate-500">Control group: {activeTabMeta?.group || 'Workspace'}</p>
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                {activeTabMeta?.label || 'Settings'} selected
              </div>
            </div>
          </div>
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
              {activeTab === 'permissions' && <PermissionsEditor />}
              {activeTab === 'audit-log' && <AuditLogViewer />}
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
