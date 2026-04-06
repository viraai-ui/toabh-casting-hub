export interface Casting {
  id: number
  project_name: string
  client_name: string
  client_company: string
  client_contact: string
  client_email?: string
  source_detail?: string | null
  pipeline_stage?: string
  status: string
  source: string
  shoot_date_start: string
  shoot_date_end: string
  location: string
  medium: string
  project_type: string
  requirements: string
  priority: string
  budget_min: number | null
  budget_max: number | null
  assigned_to: Array<string | number | { id?: number; name?: string; role?: string }>
  assigned_ids: string | number[]
  assigned_names: string | null
  attachments_count?: number | null
  latest_attachment_url?: string | null
  custom_fields: string
  created_at: string
  updated_at: string
}

export interface ClientTag {
  id: number
  name: string
  color: string
}

export interface Client {
  id: number
  name: string
  phone: string
  email: string
  company: string
  notes: string
  contact?: string | null
  assigned_to: number | null
  created_at: string
  updated_at: string
  tags?: ClientTag[]
}

export interface TeamMember {
  id: number
  name: string
  email?: string
  phone?: string
  role: string
  avatar_url?: string
  is_active: boolean
  created_at?: string
  active_castings_count?: number
}

export interface Activity {
  id: number
  casting_id: number
  user_id?: number
  user_name: string
  action: string
  type?: string
  details?: string
  description?: string
  created_at: string
}

export interface Comment {
  id: number
  casting_id: number
  user_id?: number
  user_name: string
  text?: string
  content?: string
  parent_id?: number | null
  mentions?: string[]
  created_at: string
}

export interface CastingAttachment {
  id: number
  casting_id: number
  original_filename: string
  stored_filename?: string
  mime_type?: string
  file_size?: number
  file_ext?: string
  url: string
  created_at: string
}

export interface PipelineStage {
  id: number
  name: string
  color: string
  order: number
}

export interface LeadSource {
  id: number
  name: string
}

export interface CustomField {
  id: number | string
  name: string
  type: 'text' | 'dropdown' | 'date' | 'number' | 'file'
  tab: string
  options?: string | string[]
  required: boolean
}

export interface Role {
  id: number
  name: string
  permissions: string[]
}

export interface Permission {
  id: string
  name: string
}

export interface DashboardStats {
  total_castings: number
  active_castings: number
  closed_castings: number
  total_revenue: number
  total_clients: number
  pipeline: { status: string; count: number }[]
  trend: { month: string; count: number }[]
  recent_activity: Activity[]
  workload: { id?: number; name: string; count: number }[]
  sources: { source: string; count: number }[]
}

export interface SearchProjectResult {
  id: number
  project_name: string
  client_name?: string
  status?: string
  updated_at?: string
}

export interface SearchResult {
  projects: SearchProjectResult[]
  castings: Casting[]
  clients: Client[]
  team: TeamMember[]
}

export interface NotificationItem {
  id: string
  type: 'assignment' | 'comment' | 'status_change' | 'mention' | 'general'
  title: string
  message: string
  created_at: string
  casting_id?: number | null
  client_id?: number | null
  user_name?: string
}

export interface ProfileTaskItem {
  id: number
  project_name: string
  client_name: string
  status: string
  shoot_date_start?: string | null
  due_date?: string | null
}

export interface ProfileStats {
  total_jobs: number
  active_jobs: number
  completed_jobs: number
  pending_tasks: number
  overdue_tasks: number
}

export interface UserProfile {
  name: string
  email: string
  phone: string
  date_of_birth?: string | null
  role: string
  avatar_url?: string | null
  team_member_id?: number | null
  stats: ProfileStats
  recent_activity: Activity[]
  tasks: ProfileTaskItem[]
}
