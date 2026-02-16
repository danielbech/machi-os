export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string;
}

export interface Client {
  id: string;
  name: string;
  key: string;
  className: string;
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
