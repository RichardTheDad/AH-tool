import { apiRequest } from "./client";
import type { LatestScanResponse, ScanCalibrationSummary, ScanHistoryResponse, ScanReadiness, ScanRuntimeStatus, ScanSession } from "../types/models";

export interface RunScanPayload {
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

export function getLatestScan(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
  return apiRequest<LatestScanResponse>(`/scans/latest${query}`);
}

export function getScanHistory() {
  return apiRequest<ScanHistoryResponse>("/scans/history");
}

export function getScanReadiness() {
  return apiRequest<ScanReadiness>("/scans/readiness");
}

export function getScanStatus() {
  return apiRequest<ScanRuntimeStatus>("/scans/status");
}

export function getScanCalibration() {
  return apiRequest<ScanCalibrationSummary>("/scans/calibration");
}

export function getScan(scanId: number, limit?: number) {
  const query = typeof limit === "number" ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
  return apiRequest<ScanSession>(`/scans/${scanId}${query}`);
}
