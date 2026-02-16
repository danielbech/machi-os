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
  sort_order: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
  assignees?: string[];
  client?: string;
  day?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  role: 'owner' | 'admin' | 'member';
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}
