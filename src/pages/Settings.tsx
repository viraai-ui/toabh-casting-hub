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
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
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
  { id: 'pipeline', label: 'Pipeline', icon: Workflow, group: 'Workflow', summary: 'Stage flow, progression rules, and operating defaults.' },
  { id: 'sources', label: 'Sources', icon: Radio, group: 'Workflow', summary: 'Lead intake sources and channel hygiene.' },
  { id: 'custom-fields', label: 'Fields', icon: Rows3, group: 'Data model', summary: 'Schema additions that shape records and views.' },
  { id: 'client-tags', label: 'Client Tags', icon: Tags, group: 'Data model', summary: 'Shared labels for segmentation and reporting.' },
  { id: 'permissions', label: 'Roles & Permissions', icon: Shield, group: 'Access', summary: 'Access guardrails and permission boundaries.' },
  { id: 'audit-log', label: 'Audit Log', icon: Activity, group: 'Access', summary: 'Operational trace for admin actions and changes.' },
  { id: 'roles', label: 'Roles', icon: ShieldCheck, group: 'Access', summary: 'Role structure for the workspace control model.' },
  { id: 'team', label: 'Team', icon: Users, group: 'People', summary: 'Team membership, setup, and accountability.' },
  { id: 'email', label: 'Email', icon: Mail, group: 'Comms', summary: 'Outbound automation and message system defaults.' },
  { id: 'notifications', label: 'Notifications', icon: BellRing, group: 'Comms', summary: 'Alert rules for follow-through and visibility.' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Workspace', summary: 'Workspace-level defaults for the main operating view.' },
] as const

export function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pipeline')
  const [query, setQuery] = useState('')
  const [focusGroup, setFocusGroup] = useState<'All' | typeof tabs[number]['group']>('All')
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
  const groups = useMemo(() => ['All', ...new Set(tabs.map((tab) => tab.group))] as const, [])
  const filteredTabs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tabs.filter((tab) => {
      const matchesGroup = focusGroup === 'All' || tab.group === focusGroup
      const matchesQuery = !normalizedQuery
        || tab.label.toLowerCase().includes(normalizedQuery)
        || tab.group.toLowerCase().includes(normalizedQuery)
        || tab.summary.toLowerCase().includes(normalizedQuery)

      return matchesGroup && matchesQuery
    })
  }, [focusGroup, query])
  const groupedTabs = useMemo(() => {
    return filteredTabs.reduce<Record<string, Array<(typeof tabs)[number]>>>((acc, tab) => {
      if (!acc[tab.group]) acc[tab.group] = []
      acc[tab.group].push(tab)
      return acc
    }, {})
  }, [filteredTabs])

  useEffect(() => {
    if (!filteredTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(filteredTabs[0]?.id || 'pipeline')
    }
  }, [activeTab, filteredTabs])

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
    <div className="mx-auto w-full max-w-[1440px] space-y-5 sm:space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_42%),linear-gradient(180deg,_#ffffff_0%,_#fffbeb_100%)] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Settings control surface
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2.1rem]">
                Workspace controls with clearer priorities, faster scanning, and cleaner admin flow.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Keep workflow structure, access guardrails, team setup, communications, and workspace defaults in one tighter operating layer.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Priority now</div>
                <div className="mt-1 font-semibold text-slate-900">{activeTabMeta?.label || 'Settings'}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{activeTabMeta?.summary || 'Workspace control surface'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Coverage</div>
                <div className="mt-1 font-semibold text-slate-900">{tabs.length} settings areas</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">Across {groupCount} control groups for admin operations.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Admin state</div>
                <div className="mt-1 font-semibold text-emerald-900">Verified access</div>
                <div className="mt-1 text-xs leading-5 text-emerald-700">You are viewing the full settings surface with admin permissions.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search settings by area, group, or purpose"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => {
                const active = focusGroup === group
                return (
                  <button
                    key={group}
                    onClick={() => setFocusGroup(group)}
                    className={cn(
                      'rounded-full px-3 py-2 text-xs font-semibold transition sm:text-sm',
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    )}
                  >
                    {group}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 shadow-sm sm:text-sm">
            Pick a control area first, then make changes inside the selected module below.
          </div>
        </div>
      </section>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 shadow-sm">
        {query.trim() || focusGroup !== 'All'
          ? `The settings surface is currently narrowed${focusGroup !== 'All' ? ` to the ${focusGroup} group` : ''} so you can reach the right admin area faster.`
          : 'Use search when you know the control you need, or browse by group when you want to review the broader operating system.'}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <aside className="rounded-[28px] border border-slate-200/80 bg-white p-3 shadow-sm">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Navigation</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Browse by operating area</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Filter the surface, then jump directly into the control section that needs attention.</p>
            </div>

            <nav className="mt-3 space-y-3">
              {Object.entries(groupedTabs).map(([group, groupTabs]) => (
                <div key={group} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-2">
                  <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group}</div>
                  <div className="space-y-1.5">
                    {groupTabs.map((tab) => {
                      const Icon = tab.icon
                      const active = activeTab === tab.id

                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-150',
                            active
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                              active ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{tab.label}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">{tab.summary}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>

        <div className="flex-shrink-0 lg:hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{filteredTabs.length} visible areas</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 ring-1 ring-slate-200">{groupCount} groups</span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200">Active: {activeTabMeta?.label || 'Settings'}</span>
          </div>
          <div className="overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar:hidden]">
            <div className="flex min-w-full w-max gap-1.5 px-1 pb-1">
              {filteredTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-150 sm:text-sm',
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

        <div className="min-w-0 space-y-4 lg:pt-0">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current settings area</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xl font-semibold text-slate-950">{activeTabMeta?.label || 'Settings'}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200">
                    {activeTabMeta?.group || 'Workspace'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{activeTabMeta?.summary || 'Manage workspace settings.'}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 shadow-sm sm:text-sm">
                {activeTabMeta?.label || 'Settings'} selected
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 shadow-sm">
              {activeTabMeta
                ? `${activeTabMeta.label} is the active control area. Review the framing here first, then adjust the module below with confidence.`
                : 'Choose a control area to load its admin module and configuration context.'}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Operating signal</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{activeTabMeta?.group || 'Workspace'} controls</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">Use this section to adjust the governing rules for this part of the workspace.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Visible scope</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{filteredTabs.length} matched areas</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">Search and group filters narrow the menu without changing any module behavior.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admin flow</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Review, then configure</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">Scan the framing above, confirm the right area, then work inside the module content below.</div>
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
