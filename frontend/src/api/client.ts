import { supabase } from "../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
let redirectingToLogin = false;
type AuthMode = "required" | "optional";

class MissingAuthTokenError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
  }
}

async function redirectToLogin(reason: string): Promise<void> {
  if (redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;
  try {
    await supabase.auth.signOut();
  } catch {
    // Continue redirect even if sign-out fails so the user can recover the session.
  }

  if (window.location.pathname !== "/login") {
    window.location.assign(`/login?reason=${encodeURIComponent(reason)}`);
  }
}

async function getAuthHeaders(authMode: AuthMode): Promise<{ headers: Record<string, string>; hasSession: boolean }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    if (authMode === "required") {
      await redirectToLogin("missing-session");
      throw new MissingAuthTokenError();
    }
    return { headers: {}, hasSession: false };
  }

  return { headers: { Authorization: `Bearer ${token}` }, hasSession: true };
}

async function handleUnauthorized(response: Response, hasSession: boolean): Promise<void> {
  if (response.status !== 401 || !hasSession) {
    return;
  }

  await redirectToLogin("unauthorized");
}

async function requestJson<T>(path: string, init: RequestInit | undefined, authMode: AuthMode): Promise<T> {
  const { headers: authHeaders, hasSession } = await getAuthHeaders(authMode);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    await handleUnauthorized(response, hasSession);
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? `Request failed for ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(path, init, "required");
}

export async function apiOptionalAuthRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(path, init, "optional");
}

export async function apiFormRequest<T>(path: string, body: FormData): Promise<T> {
  const { headers: authHeaders, hasSession } = await getAuthHeaders("required");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders,
    body,
  });

  if (!response.ok) {
    await handleUnauthorized(response, hasSession);
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? `Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}
