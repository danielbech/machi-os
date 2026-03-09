export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string;
}

export interface ClientGroup {
  id: string;
  project_id: string;
  name: string;
  logo_url?: string;
  sort_order: number;
  created_at: string;
}

export interface ClientStatusDef {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  treat_as_active: boolean;
  show_dotted_border: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  color: string;
  logo_url?: string;
  icon?: string;
  sort_order: number;
  active: boolean;
  status_id?: string;
  client_group_id?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export type DayName = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type WeekMode = "5-day" | "7-day" | "custom" | "rolling";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
  assignees: string[];
  client?: string;
  day?: string;  // weekday name (e.g. "monday") or ISO date (e.g. "2026-03-06") depending on mode
  type?: "task" | "note" | "divider";
  folder_id?: string;
  checklist: ChecklistItem[];
  images?: string[];
}

export interface BacklogFolder {
  id: string;
  area_id: string;
  client_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  logo_url?: string;
  role: 'owner' | 'admin' | 'member';
  week_mode: WeekMode;
  transition_day: number;
  transition_hour: number;
}

export interface PendingInvite {
  id: string;
  project_id: string;
  email: string;
  role: "owner" | "admin" | "member";
  invited_by?: string;
  created_at: string;
}

export type FeedbackCategory = "idea" | "bug" | "feedback";
export type FeedbackStatus = "open" | "resolved";

export type TimelineEntryType = "project" | "event";

export interface TimelineEntry {
  id: string;
  project_id: string;
  client_id?: string;
  parent_id?: string;
  title: string;
  start_date: string;
  end_date: string;
  color: string;
  icon?: string;
  sort_order: number;
  type: TimelineEntryType;
  created_at: string;
}

export interface TimelineMarker {
  id: string;
  project_id: string;
  label: string;
  date: string;
  entry_id?: string;
  created_at: string;
}

export interface BoardColumn {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
}

export interface FeedbackColumn {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
}

// ─── Hours ──────────────────────────────────────────────────────────────────

export interface InvoiceGroup {
  id: string;
  project_id: string;
  client_id: string;
  name: string;
  invoice_number: string | null;
  hourly_rate: number;
  currency: string;
  exchange_rate: number;
  status: 'active' | 'closed';
  sort_order: number;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface HourEntry {
  id: string;
  invoice_group_id: string;
  client_id: string;
  project_id: string;
  description: string;
  duration: number;
  date: string;
  logged_by: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineItem {
  id: string;
  project_id: string;
  client_id: string;
  amount: number;
  expected_month: string; // "YYYY-MM"
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Docs ────────────────────────────────────────────────────────────────────

export interface Doc {
  id: string;
  project_id: string;
  parent_id: string | null;
  created_by: string;
  title: string;
  content: Record<string, unknown>;
  icon: string | null;
  cover_image: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocComment {
  id: string;
  doc_id: string;
  project_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  selection: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    display_name: string;
    initials: string;
    color: string;
    avatar_url?: string;
  };
}

export type ReactionType = 'thumbsup' | 'heart' | 'fire';

export interface FeedbackTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  column_id: string | null;
  sort_order: number;
  reactions: Record<ReactionType, number>;
  user_reactions: ReactionType[];
  created_at: string;
  author?: {
    display_name: string;
    initials: string;
    color: string;
    avatar_url?: string;
  };
}
