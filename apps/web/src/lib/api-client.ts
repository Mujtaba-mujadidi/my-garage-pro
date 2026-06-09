import type { AuthSessionDto } from "@mygaragepro/shared";
import { getAccessToken, getSession } from "./auth-session";

const API_BASE = "/api/backend";
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function resolveAccessToken(): string | null {
  return getAccessToken() ?? getSession()?.accessToken ?? null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = resolveAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Request timed out — is the API running?", 0);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function parseErrorResponse(res: Response): Promise<string> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(", ");
    else if (body.message) message = body.message;
  } catch {
    /* ignore */
  }
  return message;
}

/** Authenticated binary download (e.g. invoice PDF). */
export async function apiFetchBlob(
  path: string,
  init?: RequestInit,
): Promise<{ blob: Blob; filename?: string }> {
  const token = resolveAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Request timed out — is the API running?", 0);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new ApiError(await parseErrorResponse(res), res.status);
  }

  const disposition = res.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const blob = await res.blob();
  return { blob, filename: filenameMatch?.[1] };
}

export async function openAuthenticatedPdf(invoiceId: string) {
  const { blob } = await apiFetchBlob(`/invoices/${invoiceId}/pdf`);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadAuthenticatedPdf(invoiceId: string, filename?: string) {
  const { blob, filename: fromHeader } = await apiFetchBlob(`/invoices/${invoiceId}/pdf`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? fromHeader ?? "invoice.pdf";
  link.click();
  URL.revokeObjectURL(url);
}

export function loginRequest(email: string, password: string) {
  return apiFetch<AuthSessionDto>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function meRequest() {
  return apiFetch<AuthSessionDto>("/auth/me");
}

export function changePasswordRequest(currentPassword: string, newPassword: string) {
  return apiFetch<AuthSessionDto>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
