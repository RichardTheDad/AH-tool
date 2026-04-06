import { apiRequest } from "./client";
import type { LatestScanResponse, ScanSession } from "../types/models";

export interface RunScanPayload {
  provider_name?: string;
  preset_id?: number;
  refresh_live?: boolean;
  include_losers?: boolean;
}

export function runScan(payload: RunScanPayload) {
  return apiRequest<ScanSession>("/scans/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLatestScan() {
  return apiRequest<LatestScanResponse>("/scans/latest");
}

export function getScan(scanId: number) {
  return apiRequest<ScanSession>(`/scans/${scanId}`);
}

