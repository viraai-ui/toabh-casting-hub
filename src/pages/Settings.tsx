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
  { id: 'pipeline', label: 'Pipeline Stages' },
  { id: 'sources', label: 'Lead Sources' },
  { id: 'custom-fields', label: 'Custom Fields' },
  { id: 'roles', label: 'Roles' },
  { id: 'team', label: 'Team' },
  { id: 'email', label: 'Email Templates' },
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
      <div className="max-w-md mx-auto card p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Admin Access Required</h2>
        <p className="text-slate-500 mb-6">Please verify your identity to access settings.</p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary"
        >
          Go to Login
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar Tabs */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="card p-2 sticky top-24">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="lg:hidden w-full overflow-x-auto pb-2">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'text-slate-600 bg-slate-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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
