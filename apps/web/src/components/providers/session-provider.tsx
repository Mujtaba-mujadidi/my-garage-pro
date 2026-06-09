"use client";

import type { AuthSessionDto, Permission } from "@mygaragepro/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  const refreshIdRef = useRef(0);
  const refreshInFlightRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const refreshId = ++refreshIdRef.current;
    const cached = getSession();
    if (!cached?.accessToken) {
      setSessionState(null);
      setLoading(false);
      return;
    }

    refreshInFlightRef.current += 1;
    setLoading(true);
    try {
      const fresh = await meRequest();
      if (refreshId !== refreshIdRef.current) return;
      setSession(fresh);
      setSessionState(fresh);
    } catch {
      if (refreshId !== refreshIdRef.current) return;
      clearSession();
      setSessionState(null);
    } finally {
      refreshInFlightRef.current = Math.max(0, refreshInFlightRef.current - 1);
      if (refreshInFlightRef.current === 0) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const setAuthSession = useCallback((s: AuthSessionDto) => {
    refreshIdRef.current += 1;
    setSession(s);
    setSessionState(s);
    setLoading(false);
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
