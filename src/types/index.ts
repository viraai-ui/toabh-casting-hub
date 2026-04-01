export interface Casting {
  id: number
  project_name: string
  client_name: string
  client_company: string
  client_contact: string
  client_email?: string
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
  assigned_to: string[]
  assigned_ids: string | number[]
  assigned_names: string | null
  custom_fields: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: number
  name: string
  phone: string
  email: string
  company: string
  notes: string
  assigned_to: number | null
  created_at: string
  updated_at: string
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

export interface SearchResult {
  castings: Casting[]
  clients: Client[]
  team: TeamMember[]
}
