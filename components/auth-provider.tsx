"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email?: string | null;
  username?: string;
  displayName?: string;
  user_metadata?: {
    user_name?: string;
    full_name?: string;
  };
}

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { user?: AuthUser | null; configured?: boolean };
        setUser(data.user ?? null);
        if (typeof data.configured === "boolean") {
          setConfigured(data.configured);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: AuthUser | null; configured?: boolean } | null) => {
        if (!active) return;
        if (data) {
          setUser(data.user ?? null);
          if (typeof data.configured === "boolean") {
            setConfigured(data.configured);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured,
      refresh,
    }),
    [user, loading, configured, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
