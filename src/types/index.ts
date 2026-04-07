export interface Casting {
  id: number
  source: string
  source_detail: string | null
  client_name: string
  client_company: string
  client_contact: string
  project_name: string
  project_type: string | null
  shoot_date_start: string
  shoot_date_end: string
  location: string
  medium: string
  usage: string
  budget_min: number | null
  budget_max: number | null
  requirements: string | null
  apply_to: string | null
  status: string
  priority: string
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  assigned_to?: { id: number; name: string }[]
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
  duplicates_existing: Array<{ row_num: number; name: string; phone: string; email: string; existing_id: number; existing_name: string; matched_on: string }>
  importable: Array<{ name: string; instagram_handle: string | null; phone: string; email: string }>
}
