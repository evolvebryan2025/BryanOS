// ============================================================
// BryanOS 1.0 — TypeScript Interfaces
// ============================================================

export type TaskStatus = "not_started" | "in_progress" | "qa" | "done" | "blocked";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type MemberRole = "owner" | "admin" | "builder" | "viewer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  role: MemberRole;
  is_active: boolean;
  user: User;
}

export interface Client {
  id: string;
  name: string;
  primary_assignee?: string;
  backup_assignee?: string;
  priority_level: string;
  notes?: string;
  is_active: boolean;
  primary_assignee_user?: User;
  backup_assignee_user?: User;
}

export interface System {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  client_id?: string;
  system_id?: string;
  assigned_to?: string;
  created_by: string;
  meeting_timestamp?: string;
  notes?: string;
  due_date?: string;
  estimated_hours?: number;
  sort_order?: number;
  date_completed?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  client?: { id: string; name: string };
  system?: { id: string; name: string };
  assignee?: { id: string; full_name: string; avatar_url?: string };
  creator?: { id: string; full_name: string };
  comments?: TaskComment[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: { id: string; full_name: string; avatar_url?: string };
}

export interface ActivityLogEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  user: { id: string; full_name: string; avatar_url?: string };
}

export interface WorkspaceStats {
  total_tasks: number;
  not_started: number;
  in_progress: number;
  qa: number;
  done: number;
  blocked: number;
  critical: number;
  overdue: number;
  completed_today: number;
  completed_this_week: number;
}

export interface VelocityEntry {
  completion_date: string;
  tasks_completed: number;
  avg_completion_hours: number;
}

export interface ReferralContact {
  id: string;
  name: string;
  company?: string;
  relationship?: string;
}

export interface ReferralMessage {
  contact: ReferralContact;
  message: string;
  copied: boolean;
}

// API response wrappers
export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface TasksResponse {
  success: boolean;
  tasks: Task[];
  count: number;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  client_id?: string;
  assigned_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// View modes
export type ViewMode = "table" | "kanban";

// Delegation Agent
export interface TaskAssignment {
  task: {
    title: string;
    priority: string;
    system?: string;
    timestamp?: string;
    notes?: string;
    description?: string;
  };
  assigneeId: string;
  assigneeName: string;
}

export interface DelegationMessage {
  assigneeId: string;
  assigneeName: string;
  taskCount: number;
  message: string;
}

export interface DelegationResponse {
  success: boolean;
  delegations: DelegationMessage[];
  provider: string;
}
