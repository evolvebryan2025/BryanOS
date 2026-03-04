"use client";

import { useEffect, useState } from "react";
import {
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTaskStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { ActivityLogEntry } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, fetchStats } = useTaskStore();
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    fetchStats();
    api
      .getActivity(10)
      .then((res) => setActivity(res.activity))
      .catch(() => {});
  }, [fetchStats]);

  const displayName = user?.user_metadata?.full_name || user?.email || "Bryan";
  const firstName = displayName.split(" ")[0];

  const statCards = [
    {
      label: "Total Tasks",
      value: stats?.total_tasks ?? "\u2014",
      icon: ListTodo,
      color: "text-brand-red",
      bg: "bg-brand-red/10",
    },
    {
      label: "In Progress",
      value: stats?.in_progress ?? "\u2014",
      icon: Clock,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Completed",
      value: stats?.done ?? "\u2014",
      icon: CheckCircle2,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Blocked",
      value: stats?.blocked ?? "\u2014",
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
  ];

  const quickLinks = [
    { id: "queue", label: "Build Queue", href: "/dashboard/queue", icon: ListTodo },
    { id: "team", label: "Team Hub", href: "/dashboard/team", icon: Users },
    { id: "referrals", label: "Referrals", href: "/dashboard/referrals", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-foreground">
          Welcome back, {firstName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspace today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="glass border-white/8 hover:border-white/12 transition-smooth"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions + Recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <Card className="glass border-white/8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-white/5 transition-smooth"
              >
                <div className="flex items-center gap-3">
                  <link.icon className="h-4 w-4 text-muted-foreground group-hover:text-brand-red transition-colors" />
                  <span className="text-sm text-foreground">{link.label}</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="glass border-white/8 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-smooth"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">
                          {entry.user?.full_name || "System"}
                        </span>{" "}
                        {entry.action} {entry.target_type}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No recent activity yet.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Task updates, team changes, and more will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
