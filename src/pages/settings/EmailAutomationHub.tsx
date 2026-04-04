import { EmailConfig } from './EmailConfig'
import { EmailTemplates } from './EmailTemplates'
import { AutomationSettings } from './AutomationSettings'

export function EmailAutomationHub() {
  return (
    <div className="space-y-8">
      <EmailConfig />
      <AutomationSettings />
      <EmailTemplates />
    </div>
  )
}
