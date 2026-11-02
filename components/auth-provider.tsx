"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthState = { user: User | null; loading: boolean; configured: boolean; refresh: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = Boolean(getSupabaseConfig());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const client = createSupabaseBrowserClient();
    let active = true;
    void client.auth.getUser().then(({ data }) => { if (active) { setUser(data.user); setLoading(false); } }).catch(() => { if (active) setLoading(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [configured]);

  const value = useMemo<AuthState>(() => ({
    user, loading, configured,
    async refresh() {
      if (!configured) { setUser(null); return; }
      const { data } = await createSupabaseBrowserClient().auth.getUser();
      setUser(data.user);
    },
  }), [user, loading, configured]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
