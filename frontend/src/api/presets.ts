import { apiRequest } from "./client";
import type { ScanPreset } from "../types/models";

type ScanPresetPayload = Omit<ScanPreset, "id" | "is_default"> & { is_default?: boolean };

export function getPresets() {
  return apiRequest<ScanPreset[]>("/presets");
}

export function getDefaultPreset() {
  return apiRequest<ScanPreset | null>("/presets/default");
}

export function createPreset(payload: ScanPresetPayload) {
  return apiRequest<ScanPreset>("/presets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePreset(id: number, payload: Partial<ScanPresetPayload>) {
  return apiRequest<ScanPreset>(`/presets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePreset(id: number) {
  return apiRequest<void>(`/presets/${id}`, { method: "DELETE" });
}

export function setDefaultPreset(id: number) {
  return apiRequest<ScanPreset>(`/presets/${id}/set-default`, { method: "POST" });
}

export function clearDefaultPreset() {
  return apiRequest<void>("/presets/default", { method: "DELETE" });
}

