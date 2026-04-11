// ============================================================
// AWFood Ticket Management - Core Types
// ============================================================

// --- Enums ---
export type OrgType = 'internal' | 'client' | 'whitelabel'

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'agent'
  | 'viewer'
  | 'org_admin'
  | 'org_member'

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_client'
  | 'waiting_internal'
  | 'resolved'
  | 'closed'
  | 'cancelled'

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low'

export type TicketCategory =
  | 'bug'
  | 'feature_request'
  | 'support'
  | 'billing'
  | 'integration'
  | 'configuration'

export type AffectedService = 'painel' | 'pdv' | 'api' | 'admin' | 'site'

export type TicketImpact =
  | 'single_user'
  | 'multiple_users'
  | 'all_users'
  | 'system_wide'

export type CommentType =
  | 'reply'
  | 'internal_note'
  | 'status_change'
  | 'system'
  | 'ai_analysis'
  | 'dev_note'
  | 'ai_dev_prompt'

export type IntegrationProvider = 'jira' | 'github'
export type AIProvider = 'openrouter' | 'claude' | 'openai'
export type LinkType = 'created_from' | 'related' | 'blocks' | 'blocked_by'

export type NotificationType =
  | 'ticket_assigned'
  | 'new_comment'
  | 'status_changed'
  | 'sla_breach'
  | 'mention'

// --- Database Models ---
export interface Organization {
  id: string
  name: string
  slug: string
  type: OrgType
  parent_org_id: string | null
  logo_url: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Relations
  parent?: Organization
  children?: Organization[]
  members?: OrgMember[]
}

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  is_internal: boolean
  phone: string | null
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  user_id: string
  org_id: string
  role: UserRole
  is_active: boolean
  invited_by: string | null
  joined_at: string
  created_at: string
  // Relations
  profile?: Profile
  organization?: Organization
}

export interface Ticket {
  id: string
  ticket_number: string
  org_id: string
  title: string
  description: string
  description_html: string | null
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory | null
  subcategory: string | null
  affected_service: AffectedService | null
  environment: string | null
  impact: TicketImpact | null
  steps_to_reproduce: string | null
  expected_behavior: string | null
  actual_behavior: string | null
  created_by: string
  assigned_to: string | null
  resolved_by: string | null
  closed_by: string | null
  due_date: string | null
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_breach: boolean
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Relations
  organization?: Organization
  creator?: Profile
  assignee?: Profile
  comments?: TicketComment[]
  attachments?: TicketAttachment[]
  history?: TicketHistory[]
  external_links?: TicketExternalLink[]
  watchers?: TicketWatcher[]
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  body: string
  body_html: string | null
  is_internal: boolean
  comment_type: CommentType
  parent_comment_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Relations
  author?: Profile
  parent_comment?: TicketComment
  attachments?: TicketAttachment[]
}

export interface TicketHistory {
  id: string
  ticket_id: string
  changed_by: string
  field_name: string
  old_value: string | null
  new_value: string | null
  created_at: string
  // Relations
  changer?: Profile
}

export interface TicketAttachment {
  id: string
  ticket_id: string | null
  comment_id: string | null
  uploaded_by: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
  // Relations
  uploader?: Profile
}

export interface TicketWatcher {
  id: string
  ticket_id: string
  user_id: string
  created_at: string
  profile?: Profile
}

export interface TicketExternalLink {
  id: string
  ticket_id: string
  provider: IntegrationProvider
  external_id: string
  external_url: string
  external_status: string | null
  link_type: LinkType
  sync_enabled: boolean
  last_synced_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SlaPolicy {
  id: string
  name: string
  org_id: string | null
  priority: TicketPriority
  first_response_hours: number
  resolution_hours: number
  business_hours_only: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TicketTemplate {
  id: string
  name: string
  category: string | null
  title_template: string | null
  body_template: string
  default_priority: TicketPriority
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  ticket_id: string | null
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface IntegrationConfig {
  id: string
  provider: IntegrationProvider
  config: Record<string, unknown>
  is_active: boolean
  created_by: string
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface AISettings {
  id: string
  provider: AIProvider
  api_key_encrypted: string
  default_model: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface KnowledgeBaseArticle {
  id: string
  title: string
  content: string
  content_html: string | null
  category: string | null
  tags: string[]
  is_published: boolean
  embedding: number[] | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Relations
  author?: Profile
}

export interface AIAnalysisResult {
  id: string
  ticket_id: string
  analysis_type: string
  result: Record<string, unknown>
  model_used: string
  tokens_used: number | null
  cost_usd: number | null
  created_by: string
  created_at: string
}

export interface Permission {
  id: string
  name: string
  description: string | null
  category: string
}

export interface RolePermission {
  id: string
  role: UserRole
  permission_id: string
  permission?: Permission
}

// --- UI/State Types ---
export interface UserContext {
  profile: Profile
  memberships: OrgMember[]
  currentOrg: Organization | null
  isInternal: boolean
  role: UserRole | null
  permissions: string[]
}

export interface TicketFilters {
  status?: TicketStatus[]
  priority?: TicketPriority[]
  category?: TicketCategory[]
  assigned_to?: string
  org_id?: string
  search?: string
  date_from?: string
  date_to?: string
  tags?: string[]
  affected_service?: AffectedService
}

export interface PaginationParams {
  page: number
  per_page: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface DashboardStats {
  total_open: number
  total_in_progress: number
  total_resolved_today: number
  total_sla_breach: number
  avg_first_response_hours: number
  avg_resolution_hours: number
  sla_compliance_rate: number
  tickets_by_status: { status: TicketStatus; count: number }[]
  tickets_by_priority: { priority: TicketPriority; count: number }[]
  tickets_over_time: { date: string; created: number; resolved: number }[]
}
