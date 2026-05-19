"use client";

import type { AuthSessionDto, Permission } from "@mygaragepro/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { meRequest } from "@/lib/api-client";
import { clearSession, getSession, setSession } from "@/lib/auth-session";

type SessionContextValue = {
  session: AuthSessionDto | null;
  loading: boolean;
  setAuthSession: (s: AuthSessionDto) => void;
  refreshSession: () => Promise<void>;
  signOut: () => void;
  hasPermission: (p: Permission) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthSessionDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const cached = getSession();
    if (!cached?.accessToken) {
      setSessionState(null);
      setLoading(false);
      return;
    }
    try {
      const fresh = await meRequest();
      setSession(fresh);
      setSessionState(fresh);
    } catch {
      clearSession();
      setSessionState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const setAuthSession = useCallback((s: AuthSessionDto) => {
    setSession(s);
    setSessionState(s);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  const hasPermission = useCallback(
    (p: Permission) => session?.permissions.includes(p) ?? false,
    [session],
  );

  const value = useMemo(
    () => ({
      session,
      loading,
      setAuthSession,
      refreshSession,
      signOut,
      hasPermission,
    }),
    [session, loading, setAuthSession, refreshSession, signOut, hasPermission],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
