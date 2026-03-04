"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { useTaskStore } from "./store";

export function useRealtimeSubscription(workspaceId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchStats = useTaskStore((s) => s.fetchStats);

  useEffect(() => {
    if (!workspaceId) return;

    const supabase = getSupabase();

    // Subscribe to task changes for this workspace
    const channel = supabase
      .channel(`workspace:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          // Refetch tasks and stats on any change
          fetchTasks();
          fetchStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          // Activity feed updates are handled by the dashboard page
          // We dispatch a custom event for components that care
          window.dispatchEvent(new CustomEvent("bryanos:activity-update"));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, fetchTasks, fetchStats]);
}
