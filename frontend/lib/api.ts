// ============================================================
// BryanOS 1.0 — API Client
// ============================================================

import type {
  Task,
  TaskFilters,
  TasksResponse,
  Client,
  WorkspaceMember,
  System,
  WorkspaceStats,
  VelocityEntry,
  ActivityLogEntry,
} from "@/types";

const API_BASE = "/api/v2";

class ApiClient {
  private token: string | null = null;
  private workspaceId: string | null = null;

  setAuth(token: string, workspaceId: string) {
    this.token = token;
    this.workspaceId = workspaceId;
  }

  clearAuth() {
    this.token = null;
    this.workspaceId = null;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (this.workspaceId) {
      headers["x-workspace-id"] = this.workspaceId;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error("Network error: API server is not reachable");
    }

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Invalid response from server"
          : `Server error: ${res.status} ${res.statusText}`
      );
    }

    if (!res.ok) {
      throw new Error((data.error as string) || `Request failed: ${res.status}`);
    }

    return data as T;
  }

  // Tasks
  async getTasks(filters: TaskFilters = {}): Promise<TasksResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.client_id) params.set("client_id", filters.client_id);
    if (filters.assigned_to) params.set("assigned_to", filters.assigned_to);
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));

    const qs = params.toString();
    return this.request<TasksResponse>(`/tasks${qs ? `?${qs}` : ""}`);
  }

  async getTask(taskId: string) {
    return this.request<{ success: boolean; task: Task }>(`/tasks/${taskId}`);
  }

  async createTask(task: Partial<Task>) {
    return this.request<{ success: boolean; task: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
  }

  async createTasksBatch(tasks: Partial<Task>[]) {
    return this.request<{ success: boolean; tasks: Task[]; count: number }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ tasks }),
    });
  }

  async updateTask(taskId: string, updates: Partial<Task>) {
    return this.request<{ success: boolean; task: Task }>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(taskId: string) {
    return this.request<{ success: boolean }>(`/tasks/${taskId}`, {
      method: "DELETE",
    });
  }

  async deleteTasksBatch(taskIds: string[]) {
    return this.request<{ success: boolean; deleted: number }>("/tasks/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ taskIds }),
    });
  }

  // Task Comments
  async addComment(taskId: string, content: string) {
    return this.request<{ success: boolean; comment: unknown }>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  // Transcript Processing
  async processTranscript(transcript: string, clientId: string) {
    return this.request<{
      success: boolean;
      formatted: string;
      tasks: Partial<Task>[];
      provider: string;
    }>("/process-transcript", {
      method: "POST",
      body: JSON.stringify({ transcript, clientId }),
    });
  }

  // Config
  async getClients() {
    return this.request<{ success: boolean; clients: Client[] }>("/config/clients");
  }

  async createClient(client: Partial<Client>) {
    return this.request<{ success: boolean; client: Client }>("/config/clients", {
      method: "POST",
      body: JSON.stringify(client),
    });
  }

  async getTeamMembers() {
    return this.request<{ success: boolean; teamMembers: WorkspaceMember[] }>("/config/team-members");
  }

  async getSystems() {
    return this.request<{ success: boolean; systems: System[] }>("/config/systems");
  }

  // Assignment
  async suggestAssignee(clientId?: string, systemId?: string) {
    return this.request<{ success: boolean; assigneeId: string }>("/assign/suggest", {
      method: "POST",
      body: JSON.stringify({ clientId, systemId }),
    });
  }

  // Stats & Analytics
  async getStats() {
    return this.request<{ success: boolean; stats: WorkspaceStats }>("/stats");
  }

  async getVelocity(days = 30) {
    return this.request<{ success: boolean; velocity: VelocityEntry[] }>(`/analytics/velocity?days=${days}`);
  }

  async getActivity(limit = 50) {
    return this.request<{ success: boolean; activity: ActivityLogEntry[] }>(`/activity?limit=${limit}`);
  }

  // Referral Messages
  async generateReferralMessages(
    contacts: { name: string; company?: string; relationship?: string }[],
    pitch: string,
    offer?: string,
    senderName?: string,
  ) {
    return this.request<{
      success: boolean;
      messages: { contact: unknown; message: string }[];
      provider: string;
    }>("/generate-referral-messages", {
      method: "POST",
      body: JSON.stringify({ contacts, pitch, offer, senderName }),
    });
  }
}

export const api = new ApiClient();
