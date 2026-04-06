import { apiRequest } from "./client";
import type { AppSettings } from "../types/models";

export function getSettings() {
  return apiRequest<AppSettings>("/settings");
}

export function updateSettings(payload: Partial<AppSettings>) {
  return apiRequest<AppSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

