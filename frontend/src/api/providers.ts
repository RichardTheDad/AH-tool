import { apiOptionalAuthRequest } from "./client";
import type { ProviderStatusResponse } from "../types/models";

export function getProviderStatus() {
  return apiOptionalAuthRequest<ProviderStatusResponse>("/providers/status");
}

