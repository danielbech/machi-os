export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string;
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
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export type DayName = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type WeekMode = "5-day" | "7-day";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
  assignees: string[];
  client?: string;
  day?: DayName;
  type?: "task" | "note" | "divider";
  folder_id?: string;
  checklist: ChecklistItem[];
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

export interface FeedbackTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  created_at: string;
  author?: {
    display_name: string;
    initials: string;
    color: string;
    avatar_url?: string;
  };
}
