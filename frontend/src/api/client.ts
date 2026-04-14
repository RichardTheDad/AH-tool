import { supabase } from "../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleUnauthorized(response: Response): Promise<void> {
  if (response.status === 401) {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    await handleUnauthorized(response);
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? `Request failed for ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFormRequest<T>(path: string, body: FormData): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders,
    body,
  });

  if (!response.ok) {
    await handleUnauthorized(response);
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? `Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

