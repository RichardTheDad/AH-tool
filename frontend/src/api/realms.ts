import { apiRequest } from "./client";
import type { TrackedRealm } from "../types/models";

export function getRealms() {
  return apiRequest<TrackedRealm[]>("/realms");
}

export function createRealm(payload: Omit<TrackedRealm, "id">) {
  return apiRequest<TrackedRealm>("/realms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRealm(id: number, payload: Partial<Omit<TrackedRealm, "id">>) {
  return apiRequest<TrackedRealm>(`/realms/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteRealm(id: number) {
  return apiRequest<void>(`/realms/${id}`, { method: "DELETE" });
}

