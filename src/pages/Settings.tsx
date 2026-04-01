import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { PipelineStages } from './settings/PipelineStages'
import { LeadSources } from './settings/LeadSources'
import { CustomFields } from './settings/CustomFields'
import { RolesPermissions } from './settings/RolesPermissions'
import { TeamManagement } from './settings/TeamManagement'
import { DashboardSettings } from './settings/DashboardSettings'
import { EmailTemplates } from './settings/EmailTemplates'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'sources', label: 'Sources' },
  { id: 'custom-fields', label: 'Fields' },
  { id: 'roles', label: 'Roles' },
  { id: 'team', label: 'Team' },
  { id: 'email', label: 'Email' },
  { id: 'dashboard', label: 'Dashboard' },
]

export function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pipeline')
  const [isVerified, setIsVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const verified = sessionStorage.getItem('admin_verified') === 'true'
    setIsVerified(verified)
    setChecking(false)
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
    <div className="flex flex-col h-full">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 sticky top-24">
          <nav className="space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                  activeTab === tab.id
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile top tab bar — horizontal scroll with equal-width snap */}
      <div className="lg:hidden flex-shrink-0 mb-4">
        {/* Scrollable tab strip with snap */}
        <div className="overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar:hidden]">
          <div className="flex gap-1.5 px-1 pb-1 w-max min-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all duration-150 whitespace-nowrap shrink-0',
                  activeTab === tab.id
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {activeTab === 'pipeline' && <PipelineStages />}
          {activeTab === 'sources' && <LeadSources />}
          {activeTab === 'custom-fields' && <CustomFields />}
          {activeTab === 'roles' && <RolesPermissions />}
          {activeTab === 'team' && <TeamManagement />}
          {activeTab === 'email' && <EmailTemplates />}
          {activeTab === 'dashboard' && <DashboardSettings />}
        </motion.div>
      </div>
    </div>
  )
}
