import { apiOptionalAuthRequest } from "./client";
import type { LatestScanResponse, ScanCalibrationSummary, ScanHistoryResponse, ScanReadiness, ScanRuntimeStatus, ScanSession } from "../types/models";

function normalizeScanSession(session: ScanSession | null | undefined): ScanSession | null {
  if (!session) {
    return null;
  }
  return {
    ...session,
    warning_text: session.warning_text ?? null,
    result_count: typeof session.result_count === "number" ? session.result_count : Array.isArray(session.results) ? session.results.length : 0,
    results: Array.isArray(session.results) ? session.results : [],
    available_item_classes: Array.isArray(session.available_item_classes) ? session.available_item_classes : [],
    available_realms: Array.isArray(session.available_realms) ? session.available_realms : [],
    available_category_pairs: Array.isArray(session.available_category_pairs) ? session.available_category_pairs : [],
  };
}

export interface ScanFetchOptions {
  buyRealms?: string[];
  sellRealms?: string[];
  minProfit?: number;
  minRoi?: number;
  maxBuyPrice?: number;
  minConfidence?: number;
  hideRisky?: boolean;
  category?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export const SCAN_PAGE_SIZE = 100;

export function getLatestScan(options?: ScanFetchOptions): Promise<LatestScanResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? SCAN_PAGE_SIZE));
  if (typeof options?.offset === "number" && options.offset > 0) {
    params.set("offset", String(options.offset));
  }
  options?.buyRealms?.forEach((r) => { if (r.trim()) params.append("buy_realm", r.trim()); });
  options?.sellRealms?.forEach((r) => { if (r.trim()) params.append("sell_realm", r.trim()); });
  if (options?.minProfit) params.set("min_profit", String(options.minProfit));
  if (options?.minRoi) params.set("min_roi", String(options.minRoi));
  if (options?.maxBuyPrice) params.set("max_buy_price", String(options.maxBuyPrice));
  if (options?.minConfidence) params.set("min_confidence", String(options.minConfidence));
  if (options?.hideRisky) params.set("hide_risky", "true");
  if (options?.category) params.set("category", options.category);
  if (options?.sortBy && options.sortBy !== "final_score") params.set("sort_by", options.sortBy);
  if (options?.sortDirection && options.sortDirection !== "desc") params.set("sort_direction", options.sortDirection);
  const query = params.toString();
  return apiOptionalAuthRequest<LatestScanResponse>(`/scans/latest${query ? `?${query}` : ""}`).then((payload) => ({
    ...payload,
    latest: normalizeScanSession(payload?.latest),
    has_more: payload?.has_more ?? false,
    next_offset: payload?.next_offset ?? null,
  }));
}

export function getScanHistory() {
  return apiOptionalAuthRequest<ScanHistoryResponse>("/scans/history").then((payload) => ({
    scans: Array.isArray(payload?.scans) ? payload.scans : [],
  }));
}

export function getScanReadiness() {
  return apiOptionalAuthRequest<ScanReadiness>("/scans/readiness").then((payload) => ({
    ...payload,
    missing_realms: Array.isArray(payload?.missing_realms) ? payload.missing_realms : [],
    stale_realms: Array.isArray(payload?.stale_realms) ? payload.stale_realms : [],
    realms: Array.isArray(payload?.realms) ? payload.realms : [],
  }));
}

export function getScanStatus(filters?: { buyRealm?: string; sellRealm?: string }) {
  const params = new URLSearchParams();
  if (filters?.buyRealm) {
    params.set("buy_realm", filters.buyRealm);
  }
  if (filters?.sellRealm) {
    params.set("sell_realm", filters.sellRealm);
  }
  const query = params.toString();
  const path = query ? `/scans/status?${query}` : "/scans/status";
  return apiOptionalAuthRequest<ScanRuntimeStatus>(path);
}

export function getScanCalibration() {
  return apiOptionalAuthRequest<ScanCalibrationSummary>("/scans/calibration").then((payload) => ({
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
  return apiOptionalAuthRequest<ScanSession>(`/scans/${scanId}${query}`).then((session) => normalizeScanSession(session) as ScanSession);
}
