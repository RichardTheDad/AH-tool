import { apiRequest } from "./client";
import type { ScanPreset } from "../types/models";

export function getPresets() {
  return apiRequest<ScanPreset[]>("/presets");
}

export function createPreset(payload: Omit<ScanPreset, "id">) {
  return apiRequest<ScanPreset>("/presets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePreset(id: number, payload: Partial<Omit<ScanPreset, "id">>) {
  return apiRequest<ScanPreset>(`/presets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePreset(id: number) {
  return apiRequest<void>(`/presets/${id}`, { method: "DELETE" });
}

