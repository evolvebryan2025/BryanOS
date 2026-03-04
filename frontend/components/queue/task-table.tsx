"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit2, Trash2 } from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import { cn } from "@/lib/utils";

interface TaskTableProps {
  tasks: Task[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onViewTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  critical: { label: "Critical", className: "priority-critical" },
  high: { label: "High", className: "priority-high" },
  medium: { label: "Medium", className: "priority-medium" },
  low: { label: "Low", className: "priority-low" },
};

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "status-not-started" },
  in_progress: { label: "In Progress", className: "status-in-progress" },
  qa: { label: "QA", className: "status-qa" },
  done: { label: "Done", className: "status-done" },
  blocked: { label: "Blocked", className: "status-blocked" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TaskTable({
  tasks,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onViewTask,
  onEditTask,
  onDeleteTask,
}: TaskTableProps) {
  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/8 hover:bg-transparent">
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={allSelected ? onClearSelection : onSelectAll}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand-red"
              />
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Task
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
              Client
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
              System
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Priority
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
              Assigned To
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                No tasks found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => {
              const priority = priorityConfig[task.priority] || priorityConfig.medium;
              const status = statusConfig[task.status] || statusConfig.not_started;
              const isSelected = selectedIds.includes(task.id);

              return (
                <TableRow
                  key={task.id}
                  className={cn(
                    "border-white/5 cursor-pointer transition-smooth",
                    isSelected ? "bg-brand-red/5" : "hover:bg-white/3"
                  )}
                  onClick={() => onViewTask(task)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(task.id)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand-red"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {task.client?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {task.system?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                        priority.className
                      )}
                    >
                      {priority.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm font-medium", status.className)}>
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-white/10 text-[10px] font-semibold text-foreground">
                            {getInitials(task.assignee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">
                          {task.assignee.full_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/50">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-36 bg-popover border-border"
                      >
                        <DropdownMenuItem
                          onClick={() => onViewTask(task)}
                          className="text-sm cursor-pointer focus:bg-white/5"
                        >
                          <Eye className="mr-2 h-3.5 w-3.5" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onEditTask(task)}
                          className="text-sm cursor-pointer focus:bg-white/5"
                        >
                          <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          onClick={() => onDeleteTask(task.id)}
                          className="text-sm text-brand-red cursor-pointer focus:bg-brand-red/10"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
