"use client";

import {
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Flame,
} from "lucide-react";
import type { WorkspaceStats } from "@/types";

interface StatCardsProps {
  stats: WorkspaceStats | null;
}

const statConfig = [
  { key: "total_tasks" as const, label: "Total", icon: ListTodo, color: "text-brand-red", bg: "bg-brand-red/10" },
  { key: "in_progress" as const, label: "In Progress", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10" },
  { key: "qa" as const, label: "QA", icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-400/10" },
  { key: "done" as const, label: "Done", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
  { key: "blocked" as const, label: "Blocked", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  { key: "critical" as const, label: "Critical", icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10" },
];

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {statConfig.map((item) => (
        <div
          key={item.key}
          className="glass rounded-xl px-4 py-3 hover:border-white/12 transition-smooth"
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${item.bg}`}>
              <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {item.label}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {stats ? stats[item.key] : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
