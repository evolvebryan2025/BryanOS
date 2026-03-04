"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  tasks: Task[];
  onViewTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}

interface KanbanColumn {
  status: TaskStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}

const columns: KanbanColumn[] = [
  {
    status: "not_started",
    label: "Not Started",
    icon: Clock,
    color: "text-gray-400",
    borderColor: "border-t-gray-500/50",
  },
  {
    status: "in_progress",
    label: "In Progress",
    icon: PlayCircle,
    color: "text-blue-400",
    borderColor: "border-t-blue-500/50",
  },
  {
    status: "qa",
    label: "QA",
    icon: AlertCircle,
    color: "text-amber-400",
    borderColor: "border-t-amber-500/50",
  },
  {
    status: "done",
    label: "Done",
    icon: CheckCircle2,
    color: "text-green-400",
    borderColor: "border-t-green-500/50",
  },
  {
    status: "blocked",
    label: "Blocked",
    icon: AlertTriangle,
    color: "text-red-400",
    borderColor: "border-t-red-500/50",
  },
];

const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityStyles: Record<TaskPriority, string> = {
  critical: "priority-critical",
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function KanbanCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="glass rounded-lg p-3 cursor-pointer hover:border-white/15 transition-smooth group"
    >
      {/* Priority + Title */}
      <div className="flex items-start gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-bold px-1.5 py-0 rounded shrink-0 mt-0.5",
            priorityStyles[task.priority]
          )}
        >
          {task.priority.charAt(0).toUpperCase()}
        </Badge>
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
          {task.title}
        </p>
      </div>

      {/* Client */}
      {task.client?.name && (
        <p className="mt-2 text-[11px] text-muted-foreground truncate">
          {task.client.name}
        </p>
      )}

      {/* Assignee */}
      {task.assignee && (
        <div className="mt-2 flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-white/10 text-[8px] font-semibold">
              {getInitials(task.assignee.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate">
            {task.assignee.full_name}
          </span>
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ tasks, onViewTask, onMoveTask }: KanbanBoardProps) {
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      not_started: [],
      in_progress: [],
      qa: [],
      done: [],
      blocked: [],
    };

    for (const task of tasks) {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    }

    // Sort by priority within each column
    for (const status of Object.keys(groups) as TaskStatus[]) {
      groups[status].sort(
        (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );
    }

    return groups;
  }, [tasks]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const columnTasks = groupedTasks[col.status] || [];

        return (
          <div
            key={col.status}
            className={cn(
              "flex min-w-[260px] flex-1 flex-col rounded-xl bg-white/[0.02] border border-white/5 border-t-2",
              col.borderColor
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <col.icon className={cn("h-4 w-4", col.color)} />
                <span className="text-xs font-semibold text-foreground">
                  {col.label}
                </span>
              </div>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 px-2 pb-2">
              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-[11px] text-muted-foreground/50">
                      No tasks
                    </p>
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onClick={() => onViewTask(task)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
