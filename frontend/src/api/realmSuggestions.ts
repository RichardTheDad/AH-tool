import { apiRequest } from "./client";
import type { SuggestedRealmLatestResponse, SuggestedRealmReport } from "../types/models";

function buildQuery(targetRealms: string[] = []) {
  if (!targetRealms.length) {
    return "";
  }
  return `?target_realms=${encodeURIComponent(targetRealms.join(","))}`;
}

export function getLatestSuggestedRealms(targetRealms: string[] = []) {
  return apiRequest<SuggestedRealmLatestResponse>(`/realm-suggestions/latest${buildQuery(targetRealms)}`);
}

export function runSuggestedRealms(targetRealms: string[] = []) {
  return apiRequest<SuggestedRealmReport>("/realm-suggestions/run", {
    method: "POST",
    body: JSON.stringify({ target_realms: targetRealms }),
  });
}
