import { apiRequest } from "./client";
import type { LatestScanResponse, ScanCalibrationSummary, ScanHistoryResponse, ScanReadiness, ScanRuntimeStatus, ScanSession } from "../types/models";

export interface RunScanPayload {
  preset_id?: number;
  refresh_live?: boolean;
  include_losers?: boolean;
  buy_realms?: string[];
  sell_realms?: string[];
}

function normalizeScanSession(session: ScanSession | null | undefined): ScanSession | null {
  if (!session) {
    return null;
  }
  return {
    ...session,
    warning_text: session.warning_text ?? null,
    result_count: typeof session.result_count === "number" ? session.result_count : Array.isArray(session.results) ? session.results.length : 0,
    results: Array.isArray(session.results) ? session.results : [],
  };
}

export function runScan(payload: RunScanPayload) {
  return apiRequest<ScanSession>("/scans/run", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((session) => normalizeScanSession(session) as ScanSession);
}

export function getLatestScan(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
  return apiRequest<LatestScanResponse>(`/scans/latest${query}`).then((payload) => ({
    ...payload,
    latest: normalizeScanSession(payload?.latest),
  }));
}

export function getScanHistory() {
  return apiRequest<ScanHistoryResponse>("/scans/history").then((payload) => ({
    scans: Array.isArray(payload?.scans) ? payload.scans : [],
  }));
}

export function getScanReadiness() {
  return apiRequest<ScanReadiness>("/scans/readiness").then((payload) => ({
    ...payload,
    missing_realms: Array.isArray(payload?.missing_realms) ? payload.missing_realms : [],
    stale_realms: Array.isArray(payload?.stale_realms) ? payload.stale_realms : [],
    realms: Array.isArray(payload?.realms) ? payload.realms : [],
  }));
}

export function getScanStatus() {
  return apiRequest<ScanRuntimeStatus>("/scans/status");
}

export function getScanCalibration() {
  return apiRequest<ScanCalibrationSummary>("/scans/calibration").then((payload) => ({
    ...payload,
    total_evaluated: typeof payload?.total_evaluated === "number" ? payload.total_evaluated : 0,
    confidence_bands: Array.isArray(payload?.confidence_bands) ? payload.confidence_bands : [],
    sellability_bands: Array.isArray(payload?.sellability_bands) ? payload.sellability_bands : [],
    horizons: Array.isArray(payload?.horizons) ? payload.horizons : [],
    trends: Array.isArray(payload?.trends) ? payload.trends : [],
    suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
  }));
}

export function getScan(scanId: number, limit?: number) {
  const query = typeof limit === "number" ? `?limit=${Math.max(1, Math.floor(limit))}` : "";
  return apiRequest<ScanSession>(`/scans/${scanId}${query}`).then((session) => normalizeScanSession(session) as ScanSession);
}
