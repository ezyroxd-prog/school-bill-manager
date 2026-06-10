import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "parent";

export interface AuthState {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  fullName: string;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true, fullName: "" });

  useEffect(() => {
    let mounted = true;

    async function loadProfile(user: User | null) {
      if (!user) {
        if (mounted) setState({ user: null, role: null, loading: false, fullName: "" });
        return;
      }
      const [{ data: roleRow }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).order("role", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setState({
        user,
        role: (roleRow?.role as AppRole) ?? "parent",
        loading: false,
        fullName: profile?.full_name ?? user.email ?? "",
      });
    }

    supabase.auth.getUser().then(({ data }) => loadProfile(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        loadProfile(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
