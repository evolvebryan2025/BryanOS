// ============================================================
// BryanOS 1.0 — Zustand State Management
// ============================================================

import { create } from "zustand";
import type {
  Task,
  Client,
  WorkspaceMember,
  System,
  WorkspaceStats,
  TaskFilters,
  ViewMode,
  TaskStatus,
} from "@/types";
import { api } from "./api";

// ============================================================
// Task Store
// ============================================================

interface TaskState {
  tasks: Task[];
  stats: WorkspaceStats | null;
  filters: TaskFilters;
  viewMode: ViewMode;
  selectedTaskIds: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setFilters: (filters: Partial<TaskFilters>) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleTaskSelection: (taskId: string) => void;
  selectAllTasks: () => void;
  clearSelection: () => void;
  createTask: (task: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  deleteSelectedTasks: () => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  stats: null,
  filters: {},
  viewMode: "table",
  selectedTaskIds: [],
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const { tasks } = await api.getTasks(get().filters);
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const { stats } = await api.getStats();
      set({ stats });
    } catch {
      // Silently fail — backend may be offline
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
    get().fetchTasks();
  },

  setViewMode: (viewMode) => set({ viewMode }),

  toggleTaskSelection: (taskId) => {
    set((state) => {
      const selected = state.selectedTaskIds.includes(taskId)
        ? state.selectedTaskIds.filter((id) => id !== taskId)
        : [...state.selectedTaskIds, taskId];
      return { selectedTaskIds: selected };
    });
  },

  selectAllTasks: () => {
    set((state) => ({ selectedTaskIds: state.tasks.map((t) => t.id) }));
  },

  clearSelection: () => set({ selectedTaskIds: [] }),

  createTask: async (taskData) => {
    const { task } = await api.createTask(taskData);
    set((state) => ({ tasks: [task, ...state.tasks] }));
    get().fetchStats();
    return task;
  },

  updateTask: async (taskId, updates) => {
    const { task: updated } = await api.updateTask(taskId, updates);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
    }));
    get().fetchStats();
  },

  deleteTask: async (taskId) => {
    await api.deleteTask(taskId);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      selectedTaskIds: state.selectedTaskIds.filter((id) => id !== taskId),
    }));
    get().fetchStats();
  },

  deleteSelectedTasks: async () => {
    const { selectedTaskIds } = get();
    if (selectedTaskIds.length === 0) return;
    await api.deleteTasksBatch(selectedTaskIds);
    set((state) => ({
      tasks: state.tasks.filter((t) => !selectedTaskIds.includes(t.id)),
      selectedTaskIds: [],
    }));
    get().fetchStats();
  },

  moveTask: async (taskId, newStatus) => {
    await get().updateTask(taskId, { status: newStatus });
  },
}));

// ============================================================
// Config Store (clients, team members, systems)
// ============================================================

interface ConfigState {
  clients: Client[];
  teamMembers: WorkspaceMember[];
  systems: System[];
  isLoading: boolean;

  fetchConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  clients: [],
  teamMembers: [],
  systems: [],
  isLoading: false,

  fetchConfig: async () => {
    set({ isLoading: true });
    try {
      const [clientsRes, teamRes, systemsRes] = await Promise.all([
        api.getClients(),
        api.getTeamMembers(),
        api.getSystems(),
      ]);
      set({
        clients: clientsRes.clients,
        teamMembers: teamRes.teamMembers,
        systems: systemsRes.systems,
        isLoading: false,
      });
    } catch {
      // Silently fail — backend may be offline
      set({ isLoading: false });
    }
  },
}));
