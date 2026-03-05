"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { api } from "./api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  workspaceId: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncAuth = useCallback(
    async (s: Session | null) => {
      if (!isSupabaseConfigured()) return;
      const supabase = getSupabase();

      if (s?.access_token) {
        // Ensure user profile exists (may be missing if migration ran after signup)
        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("id", s.user.id)
          .single();

        if (!profile) {
          const { error: profileErr } = await supabase.from("users").upsert({
            id: s.user.id,
            email: s.user.email!,
            full_name:
              s.user.user_metadata?.full_name ||
              s.user.user_metadata?.name ||
              s.user.email?.split("@")[0] ||
              "User",
            avatar_url: s.user.user_metadata?.avatar_url || null,
          });
          if (profileErr) console.error("Failed to create user profile:", profileErr.message);
        }

        // Look for existing workspace membership
        const { data: memberships } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", s.user.id)
          .eq("is_active", true)
          .limit(1);

        let wsId = memberships?.[0]?.workspace_id || null;

        // Auto-create a default workspace for new users
        if (!wsId) {
          const userName =
            s.user.user_metadata?.full_name ||
            s.user.email?.split("@")[0] ||
            "User";
          const slug = `ws-${Date.now()}`;

          const { data: newWs, error: wsErr } = await supabase
            .from("workspaces")
            .insert({ name: `${userName}'s Workspace`, slug })
            .select("id")
            .single();

          if (wsErr) {
            console.error("Failed to create workspace:", wsErr.message);
          } else if (newWs) {
            wsId = newWs.id;
          }
        }

        setWorkspaceId(wsId);

        if (wsId) {
          api.setAuth(s.access_token, wsId);
        }
      } else {
        setWorkspaceId(null);
        api.clearAuth();
      }
    },
    []
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();

    async function initSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await syncAuth(data.session);
      setIsLoading(false);
    }
    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        syncAuth(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [syncAuth]);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
    const supabase = getSupabase();
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user && !data.session) return { needsConfirmation: true };
    return {};
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    await supabase.auth.signOut();
    api.clearAuth();
    setWorkspaceId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        workspaceId,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
