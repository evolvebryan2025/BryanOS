"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, X, MessageSquare, Send } from "lucide-react";
import type { Task, TaskPriority, TaskStatus, Client, WorkspaceMember, System } from "@/types";
import { cn } from "@/lib/utils";

// ============================================================
// View Task Dialog
// ============================================================

interface ViewTaskDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

const priorityStyles: Record<TaskPriority, string> = {
  critical: "priority-critical",
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};

const statusLabels: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  qa: "QA",
  done: "Done",
  blocked: "Blocked",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ViewTaskDialog({ task, open, onClose, onEdit }: ViewTaskDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass border-white/10 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-lg font-semibold text-foreground leading-tight">
              {task.title}
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0",
                priorityStyles[task.priority]
              )}
            >
              {task.priority}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InfoField label="Status" value={statusLabels[task.status] || task.status} />
            <InfoField label="Client" value={task.client?.name || "—"} />
            <InfoField label="System" value={task.system?.name || "—"} />
            <InfoField label="Assigned To" value={task.assignee?.full_name || "Unassigned"} />
            {task.due_date && <InfoField label="Due Date" value={task.due_date} />}
            {task.estimated_hours && (
              <InfoField label="Est. Hours" value={`${task.estimated_hours}h`} />
            )}
          </div>

          {task.notes && (
            <>
              <Separator className="bg-white/8" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Notes
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{task.notes}</p>
              </div>
            </>
          )}

          {/* Comments */}
          {task.comments && task.comments.length > 0 && (
            <>
              <Separator className="bg-white/8" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Comments ({task.comments.length})
                </p>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="bg-white/10 text-[8px] font-semibold">
                          {getInitials(comment.user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {comment.user.full_name}
                          </span>{" "}
                          &middot; {new Date(comment.created_at).toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 text-sm text-foreground">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => onEdit(task)}
              className="bg-brand-red hover:bg-brand-red-dark text-white"
            >
              Edit Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

// ============================================================
// Create / Edit Task Dialog
// ============================================================

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  clients: Client[];
  teamMembers: WorkspaceMember[];
  systems: System[];
  onSubmit: (data: Partial<Task>) => Promise<void>;
}

export function TaskFormDialog({
  open,
  onClose,
  task,
  clients,
  teamMembers,
  systems,
  onSubmit,
}: TaskFormDialogProps) {
  const isEdit = !!task;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || "medium");
  const [status, setStatus] = useState<TaskStatus>(task?.status || "not_started");
  const [clientId, setClientId] = useState(task?.client_id || "");
  const [systemId, setSystemId] = useState(task?.system_id || "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || "");
  const [notes, setNotes] = useState(task?.notes || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        client_id: clientId || undefined,
        system_id: systemId || undefined,
        assigned_to: assignedTo || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass border-white/10 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit Task" : "New Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
              className="h-10 bg-white/5 border-white/10 focus:border-brand-red/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="bg-white/5 border-white/10 focus:border-brand-red/50 resize-none"
            />
          </div>

          {/* Priority + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="h-10 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="h-10 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="qa">QA</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client + System row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Client</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-10 bg-white/5 border-white/10">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">System</label>
              <Select value={systemId} onValueChange={setSystemId}>
                <SelectTrigger className="h-10 bg-white/5 border-white/10">
                  <SelectValue placeholder="Select system" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {systems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned To */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-10 bg-white/5 border-white/10">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.user_id}>
                    {m.user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              rows={2}
              className="bg-white/5 border-white/10 focus:border-brand-red/50 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !title.trim()}
              className="bg-brand-red hover:bg-brand-red-dark text-white glow-red-hover"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Task"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
