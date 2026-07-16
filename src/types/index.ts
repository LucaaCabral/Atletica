export type UserRole = 'presidente' | 'vice' | 'diretor' | 'assessor';

export interface Management {
  id: string;
  name: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EventStatus = 'planning' | 'preparing' | 'confirmed' | 'ongoing' | 'finished' | 'cancelled';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partial';
export type MarketingStatus =
  | 'received'
  | 'in_analysis'
  | 'in_production'
  | 'awaiting_approval'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'cancelled';
export type SponsorStatus =
  | 'prospecting'
  | 'contacted'
  | 'meeting_scheduled'
  | 'proposal_sent'
  | 'negotiating'
  | 'closed'
  | 'lost'
  | 'ended'
  | 'renewal';
export type ClubStatus = 'active' | 'pending' | 'expired' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'justified';
export type CalendarCategory =
  | 'event'
  | 'meeting'
  | 'game'
  | 'training'
  | 'deadline'
  | 'publication'
  | 'payment'
  | 'task'
  | 'other';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  sector_id: string | null;
  position_title: string | null;
  theme_preference: ThemePreference;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sector?: Sector | null;
}

export interface AuthorizedEmail {
  id: string;
  email: string;
  role: UserRole;
  sector_id: string | null;
  invited_by: string | null;
  used_at: string | null;
  created_at: string;
}

export type SectorType = 'generic' | 'esportes' | 'marketing' | 'patrocinio' | 'socios' | 'financeiro';
export type SectorTab =
  | 'dashboard'
  | 'kanban'
  | 'calendario'
  | 'equipe'
  | 'metas'
  | 'eventos'
  | 'financeiro'
  | 'modulo'
  | 'documentos'
  | 'configuracoes';
export type SectorGoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'missed';

export interface Sector {
  id: string;
  management_id: string | null;
  name: string;
  description: string | null;
  sector_type: SectorType;
  tabs_order: SectorTab[];
  icon: string | null;
  color: string | null;
  responsible_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectorMember {
  sector_id: string;
  profile_id: string;
  role_in_sector: 'diretor' | 'assessor';
  created_at: string;
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'> | null;
}

export interface SectorGoal {
  id: string;
  sector_id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  due_date: string | null;
  status: SectorGoalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sector?: Pick<Sector, 'id' | 'name'> | null;
}

export interface Position {
  id: string;
  name: string;
  description: string | null;
  access_level: number;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  user_id: string | null;
  full_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  position_id: string | null;
  sector_id: string | null;
  joined_at: string | null;
  left_at: string | null;
  status: 'active' | 'inactive';
  bio: string | null;
  responsibilities: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sector?: Sector | null;
  position?: Position | null;
}

export type TaskRecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  sector_id: string | null;
  event_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  labels: string[];
  is_archived: boolean;
  completed_at: string | null;
  recurrence_type: TaskRecurrenceType | null;
  recurrence_interval_days: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sector?: Sector | null;
  event?: Pick<Event, 'id' | 'name'> | null;
  assignees?: TaskAssignee[];
  favorites?: TaskFavorite[];
}

export interface TaskAssignee {
  task_id: string;
  profile_id: string;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

export interface TaskFavorite {
  task_id: string;
  profile_id: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  management_id: string | null;
  sector_id: string | null;
  name: string;
  cover_url: string | null;
  description: string | null;
  category: string | null;
  status: EventStatus;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  address: string | null;
  expected_attendance: number | null;
  actual_attendance: number | null;
  budget: number | null;
  responsible_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  responsible?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
  sector?: Pick<Sector, 'id' | 'name'> | null;
}

export interface EventMember {
  event_id: string;
  profile_id: string;
  role_in_event: string | null;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'> | null;
}

export interface EventTimelineItem {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  date: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category_id: string | null;
  date: string;
  due_date: string | null;
  paid_at: string | null;
  status: TransactionStatus;
  payment_method: string | null;
  event_id: string | null;
  sector_id: string | null;
  supplier_id: string | null;
  responsible_id: string | null;
  recurrence: string | null;
  notes: string | null;
  receipt_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory | null;
  event?: Pick<Event, 'id' | 'name'> | null;
  supplier?: Pick<Supplier, 'id' | 'name'> | null;
  sector?: Pick<Sector, 'id' | 'name'> | null;
}

export interface Sport {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  responsible_id: string | null;
  coach_name: string | null;
  training_location: string | null;
  schedule: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Athlete {
  id: string;
  full_name: string;
  photo_url: string | null;
  registration: string | null;
  course: string | null;
  semester: string | null;
  phone: string | null;
  email: string | null;
  sport_id: string | null;
  team_id: string | null;
  position: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sport?: Pick<Sport, 'id' | 'name'> | null;
}

export interface AthleteEmergencyContact {
  athlete_id: string;
  contact_name: string;
  contact_phone: string;
  relationship: string | null;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  sport_id: string;
  coach_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sport?: Pick<Sport, 'id' | 'name'> | null;
}

export interface Coach {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  sport_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Training {
  id: string;
  sport_id: string;
  team_id: string | null;
  date: string;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sport?: Pick<Sport, 'id' | 'name'> | null;
}

export interface TrainingAttendance {
  training_id: string;
  athlete_id: string;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
  athlete?: Pick<Athlete, 'id' | 'full_name' | 'photo_url'> | null;
}

export interface Game {
  id: string;
  sport_id: string;
  team_id: string | null;
  event_id: string | null;
  opponent: string | null;
  date: string;
  location: string | null;
  our_score: number | null;
  opponent_score: number | null;
  result: 'win' | 'loss' | 'draw' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sport?: Pick<Sport, 'id' | 'name'> | null;
}

export interface Sponsor {
  id: string;
  company_name: string;
  logo_url: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  segment: string | null;
  status: SponsorStatus;
  value: number | null;
  partnership_type: string | null;
  start_date: string | null;
  end_date: string | null;
  deliverables: string | null;
  counterparts: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingRequest {
  id: string;
  title: string;
  requester_id: string | null;
  sector_id: string | null;
  event_id: string | null;
  description: string | null;
  briefing: string | null;
  format: string | null;
  channel: string | null;
  due_date: string | null;
  publish_date: string | null;
  priority: TaskPriority;
  assignee_id: string | null;
  status: MarketingStatus;
  final_file_path: string | null;
  created_at: string;
  updated_at: string;
  requester?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
  event?: Pick<Event, 'id' | 'name'> | null;
  sector?: Pick<Sector, 'id' | 'name'> | null;
}

export interface MarketingComment {
  id: string;
  request_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

export interface MarketingApproval {
  id: string;
  request_id: string;
  approver_id: string | null;
  decision: 'approved' | 'changes_requested';
  comment: string | null;
  created_at: string;
  approver?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface ClubMember {
  id: string;
  full_name: string;
  photo_url: string | null;
  registration: string | null;
  course: string | null;
  email: string | null;
  phone: string | null;
  card_number: string | null;
  plan_name: string | null;
  start_date: string | null;
  valid_until: string | null;
  status: ClubStatus;
  payment_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipPayment {
  id: string;
  member_club_id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  reference: string | null;
  created_at: string;
}

export interface Benefit {
  id: string;
  title: string;
  description: string | null;
  partner_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  folder: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  version: number;
  uploaded_by: string | null;
  related_type: string | null;
  related_id: string | null;
  access_level: 'all' | 'directors' | 'admin';
  created_at: string;
  updated_at: string;
  uploader?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface CalendarEntry {
  id: string;
  title: string;
  description: string | null;
  category: CalendarCategory;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  sector_id: string | null;
  responsible_id: string | null;
  related_type: string | null;
  related_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  category: string;
  related_type: string | null;
  related_id: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  created_at: string;
  user?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface GeneralSettings {
  organizationName: string;
  systemName: string;
  description: string;
  contactEmail: string;
  instagram: string;
  website: string;
}

export interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
  defaultTheme: ThemePreference;
  logoUrl: string;
  symbolUrl: string;
}

export interface ClubSettings {
  planName: string;
  defaultValidityMonths: number;
}

export interface TaskLabelDef {
  name: string;
  color: string;
}
