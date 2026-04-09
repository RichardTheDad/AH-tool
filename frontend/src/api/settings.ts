import { apiRequest } from "./client";
import type { AppSettings, TuningActionAuditList } from "../types/models";

export function getSettings() {
  return apiRequest<AppSettings>("/settings");
}

export function updateSettings(payload: Partial<AppSettings>) {
  return apiRequest<AppSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function applyTuningPreset(presetId: "safe_calibration" | "balanced_default") {
  return apiRequest<AppSettings>("/settings/apply-tuning-preset", {
    method: "POST",
    body: JSON.stringify({ preset_id: presetId }),
  });
}

export function getTuningAudit(limit = 10) {
  const clamped = Math.max(1, Math.min(200, Math.floor(limit)));
  return apiRequest<TuningActionAuditList>(`/settings/tuning-audit?limit=${clamped}`);
}

