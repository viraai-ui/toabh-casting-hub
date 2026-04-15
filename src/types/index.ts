export interface Casting {
  id: number
  source: string
  source_detail: string | null
  client_name: string
  client_company: string
  client_contact: string
  client_email?: string | null
  project_name: string
  project_type: string | null
  shoot_date_start: string
  shoot_date_end: string
  location: string
  medium: string
  usage: string
  budget_min: number | null
  budget_max: number | null
  pipeline_stage?: string | null
  requirements: string | null
  apply_to: string | null
  status: string
  priority: string
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  assigned_to?: Array<{ id: number; name: string; role?: string }>
  assigned_ids?: string | null
  assigned_names?: string | null
  attachments_count?: number | null
  latest_attachment_url?: string | null
}

export interface Client {
  id: number
  name: string
  company: string
  phone: string
  email: string
  created_at: string
  updated_at?: string
  notes?: string | null
  tags?: Array<{ id: number; name: string; color: string; pivot: { client_id: number; tag_id: number } }>
}

export interface ClientTag {
  id: number
  name: string
  color: string
}

export interface ClientTagWithUsage {
  id: number
  name: string
  color: string
  usage_count: number
}

export interface DashboardStats {
  total_castings: number
  active_castings: number
  pending_tasks: number
  pipeline_by_stage: Array<{ stage: string; count: number }>
  recent_activities: Activity[]
}

export interface UserProfile {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string
  stage: string
  status?: string
  priority: string
  assigned_to?: number | null
  created_at: string
  due_date: string
}

export interface TaskStage {
  id: number
  name: string
  color: string
}

export interface Comment {
  id: number
  content: string
  user_name: string
  created_at: string
}

export interface CastingAttachment {
  id: number
  filename: string
  url: string
  created_at: string
}

export interface CustomField {
  id: number
  name: string
  field_type: string
  options?: string[]
  required?: boolean
}

export interface Role {
  id: number
  name: string
  permissions: string[]
}

export interface RoleState {
  id?: number
  name: string
  color: string
}

export interface TeamMember {
  id: number
  name: string
  role: string
  email: string
  phone: string
  is_active: number
  avatar_url: string | null
  active_castings_count?: number
}

export interface PipelineStage {
  id: string
  name: string
  color: string
  sort_order: number
}

export interface LeadSource {
  id: number
  name: string
  sort_order: number
}

export interface Activity {
  id: number
  casting_id: number
  action: string
  description: string
  user_name: string
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string
  stage: string
  priority: string
  created_at: string
  due_date: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  casting_id: number | null
  created_at: string
}

export interface CalendarEvent {
  id: number
  title: string
  start: string
  end: string
  status: string
  assigned_names?: string | null
  assigned_to?: { id: number; name: string }[]
  client?: string
}

// ─── Talent ──────────────────────────────────────────

export interface Talent {
  id: number
  name: string
  instagram_handle?: string | null
  phone?: string | null
  email?: string | null
  created_at?: string
  updated_at?: string
}

export interface CastingWithTalents extends Casting {
  talents?: Talent[]
}

export interface TalentImportResult {
  total_rows: number
  valid: number
  errors: Array<{ row_num: number; reason: string; raw_data: Record<string, string> }>
  duplicates_existing: Array<{ row_num: number; name: string; phone: string; email: string; existing_id: number; existing_name: string; matched_on: string; raw_data?: Record<string, string> }>
  importable: Array<{ name: string; instagram_handle: string | null; phone: string; email: string }>
}

// ─── Search ──────────────────────────────────────────
export interface SearchResult {
  projects: SearchProjectResult[]
  castings: Casting[]
  clients: Client[]
  team: TeamMember[]
  talents: Talent[]
}

export interface SearchProjectResult {
  id: number
  title: string
  status: string
}

// ─── ThreadNode (for casting communication) ──────────
export interface ThreadNode {
  id?: number
  content: string
  user_name?: string
  created_at?: string
  children?: ThreadNode[]
}

// ─── NavbarMenuItem ──────────────────────────────────
export interface NavbarMenuItem {
  icon: string
  label: string
  to: string
  active?: boolean
}
