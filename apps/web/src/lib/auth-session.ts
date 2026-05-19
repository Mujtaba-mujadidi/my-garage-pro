import type { AuthSessionDto } from "@mygaragepro/shared";

const TOKEN_KEY = "mgp-access-token";
const SESSION_KEY = "mgp-session";

export function setSession(session: AuthSessionDto): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, session.accessToken);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getSession(): AuthSessionDto | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSessionDto;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession(): boolean {
  return !!getAccessToken();
}
