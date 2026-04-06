import { apiRequest } from "./client";
import type { ProviderStatusResponse } from "../types/models";

export function getProviderStatus() {
  return apiRequest<ProviderStatusResponse>("/providers/status");
}

