"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Download,
  Filter,
} from "lucide-react";
import { useTaskStore, useConfigStore } from "@/lib/store";
import { StatCards } from "@/components/queue/stat-cards";
import { TaskTable } from "@/components/queue/task-table";
import { KanbanBoard } from "@/components/queue/kanban-board";
import { ViewTaskDialog, TaskFormDialog } from "@/components/queue/task-dialog";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { cn } from "@/lib/utils";

export default function QueuePage() {
  const {
    tasks,
    stats,
    filters,
    viewMode,
    selectedTaskIds,
    isLoading,
    fetchTasks,
    fetchStats,
    setFilters,
    setViewMode,
    toggleTaskSelection,
    selectAllTasks,
    clearSelection,
    createTask,
    updateTask,
    deleteTask,
    deleteSelectedTasks,
    moveTask,
  } = useTaskStore();

  const { clients, teamMembers, systems, fetchConfig } = useConfigStore();

  // Dialog states
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTasks();
    fetchStats();
    fetchConfig();
  }, [fetchTasks, fetchStats, fetchConfig]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setFilters({ search: value || undefined });
    },
    [setFilters]
  );

  async function handleCreateTask(data: Partial<Task>) {
    await createTask(data);
  }

  async function handleEditTask(data: Partial<Task>) {
    if (!editingTask) return;
    await updateTask(editingTask.id, data);
    setEditingTask(null);
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    await deleteTask(taskId);
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedTaskIds.length} selected tasks?`)) return;
    await deleteSelectedTasks();
  }

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <StatCards stats={stats} />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 pl-9 bg-white/5 border-white/10 text-sm placeholder:text-white/30"
            />
          </div>

          {/* Status filter */}
          <Select
            value={filters.status || "all"}
            onValueChange={(v) => setFilters({ status: v === "all" ? undefined : (v as TaskStatus) })}
          >
            <SelectTrigger className="h-9 w-[130px] bg-white/5 border-white/10 text-sm">
              <Filter className="mr-1.5 h-3 w-3 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="qa">QA</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority filter */}
          <Select
            value={filters.priority || "all"}
            onValueChange={(v) =>
              setFilters({ priority: v === "all" ? undefined : (v as TaskPriority) })
            }
          >
            <SelectTrigger className="h-9 w-[130px] bg-white/5 border-white/10 text-sm hidden sm:flex">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk actions */}
          {selectedTaskIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="h-9 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs"
            >
              <Trash2 className="mr-1.5 h-3 w-3" />
              Delete ({selectedTaskIds.length})
            </Button>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-smooth",
                viewMode === "table"
                  ? "bg-brand-red text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-smooth",
                viewMode === "kanban"
                  ? "bg-brand-red text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { fetchTasks(); fetchStats(); }}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          {/* New Task */}
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="h-9 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium glow-red-hover"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <TaskTable
          tasks={tasks}
          selectedIds={selectedTaskIds}
          onToggleSelect={toggleTaskSelection}
          onSelectAll={selectAllTasks}
          onClearSelection={clearSelection}
          onViewTask={setViewingTask}
          onEditTask={setEditingTask}
          onDeleteTask={handleDeleteTask}
        />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onViewTask={setViewingTask}
          onMoveTask={moveTask}
        />
      )}

      {/* Dialogs */}
      <ViewTaskDialog
        task={viewingTask}
        open={!!viewingTask}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => {
          setViewingTask(null);
          setEditingTask(task);
        }}
      />

      <TaskFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        clients={clients}
        teamMembers={teamMembers}
        systems={systems}
        onSubmit={handleCreateTask}
      />

      <TaskFormDialog
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        clients={clients}
        teamMembers={teamMembers}
        systems={systems}
        onSubmit={handleEditTask}
      />
    </div>
  );
}
