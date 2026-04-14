export interface ProviderStatus {
  name: string;
  provider_type: string;
  status: "available" | "cached_only" | "unavailable" | "error";
  available: boolean;
  supports_live_fetch: boolean;
  message: string;
  cache_records: number;
  last_checked_at?: string | null;
  last_error?: string | null;
}

export interface ProviderStatusResponse {
  providers: ProviderStatus[];
}

export interface TrackedRealm {
  id: number;
  realm_name: string;
  region: string;
  enabled: boolean;
}

export interface ListingSnapshot {
  id: number;
  item_id: number;
  realm: string;
  lowest_price: number | null;
  average_price: number | null;
  quantity: number | null;
  listing_count: number | null;
  source_name: string;
  captured_at: string;
  is_stale: boolean;
}

export interface ScanResult {
  id: number;
  item_id: number;
  item_name: string;
  undermine_url?: string | null;
  item_quality?: string | null;
  item_class_name?: string | null;
  item_icon_url?: string | null;
  cheapest_buy_realm: string;
  cheapest_buy_price: number;
  best_sell_realm: string;
  best_sell_price: number;
  observed_sell_price?: number | null;
  estimated_profit: number;
  roi: number;
  confidence_score: number;
  sellability_score: number;
  liquidity_score: number;
  volatility_score: number;
  bait_risk_score: number;
  final_score: number;
  turnover_label: "fast" | "steady" | "slow" | "very slow" | string;
  explanation: string;
  sell_history_prices: number[];
  generated_at: string;
  has_stale_data: boolean;
  is_risky: boolean;
  has_missing_metadata: boolean;
  personal_sale_count: number;
  personal_cancel_count: number;
  personal_expired_count: number;
  score_provenance?: Record<string, unknown> | null;
}

export interface ScanSession {
  id: number;
  provider_name: string;
  warning_text?: string | null;
  generated_at: string;
  result_count: number;
  results: ScanResult[];
}

export interface ScanSessionSummary {
  id: number;
  generated_at: string;
  provider_name: string;
  result_count: number;
}

export interface LatestScanResponse {
  latest: ScanSession | null;
}

export interface RealmScanReadiness {
  realm: string;
  has_data: boolean;
  fresh_item_count: number;
  stale_item_count: number;
  latest_item_count: number;
  freshest_captured_at?: string | null;
  latest_source_name?: string | null;
}

export interface ScanReadiness {
  status: "ready" | "caution" | "blocked";
  ready_for_scan: boolean;
  message: string;
  enabled_realm_count: number;
  realms_with_data: number;
  realms_with_fresh_data: number;
  unique_item_count: number;
  items_missing_metadata: number;
  stale_realm_count: number;
  missing_realms: string[];
  stale_realms: string[];
  oldest_snapshot_at?: string | null;
  latest_snapshot_at?: string | null;
  realms: RealmScanReadiness[];
}

export interface ScanRuntimeStatus {
  status: "idle" | "running";
  message: string;
  provider_name?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface SuggestedRealmItem {
  item_id: number;
  item_name: string;
  undermine_url?: string | null;
  target_realm: string;
  buy_price: number;
  target_sell_price: number;
  estimated_profit: number;
  roi: number;
  confidence_score: number;
  sellability_score: number;
  turnover_label: string;
}

export interface SuggestedRealm {
  realm: string;
  opportunity_count: number;
  cheapest_source_count: number;
  average_profit: number;
  average_roi: number;
  average_confidence: number;
  average_sellability: number;
  consistency_score: number;
  latest_captured_at?: string | null;
  appearance_count: number;
  cheap_run_count: number;
  window_size: number;
  recent_run_count: number;
  median_buy_price?: number | null;
  best_target_realm?: string | null;
  last_seen_cheapest_at?: string | null;
  is_tracked: boolean;
  explanation: string;
  top_items: SuggestedRealmItem[];
}

export interface SuggestedRealmReport {
  generated_at?: string | null;
  target_realms: string[];
  source_realm_count: number;
  warning_text?: string | null;
  recommendations: SuggestedRealm[];
}

export interface SuggestedRealmLatestResponse {
  latest: SuggestedRealmReport | null;
}

export interface ScanHistoryResponse {
  scans: ScanSessionSummary[];
}

export interface CalibrationBand {
  band: string;
  total: number;
  realized: number;
  realized_rate: number;
}

export interface ScanCalibrationSummary {
  total_evaluated: number;
  confidence_bands: CalibrationBand[];
  sellability_bands: CalibrationBand[];
  horizons: Array<{
    horizon_hours: number;
    total_evaluated: number;
    confidence_bands: CalibrationBand[];
    sellability_bands: CalibrationBand[];
  }>;
  trends: Array<{
    period_start: string;
    period_end: string;
    total: number;
    realized: number;
    realized_rate: number;
    avg_confidence: number;
    avg_sellability: number;
  }>;
  suggestions: Array<{
    level: string;
    message: string;
    action_id?: "safe_calibration" | "balanced_default" | null;
    action_label?: string | null;
  }>;
}

export interface AppSettings {
  id: number;
  ah_cut_percent: number;
  flat_buffer: number;
  refresh_interval_minutes: number;
  stale_after_minutes: number;
  scoring_preset: "safe" | "balanced" | "aggressive";
  non_commodity_only: boolean;
}

export interface TuningActionAuditEntry {
  id: number;
  action_id: string;
  action_label: string;
  source: string;
  applied_at: string;
  blocked: boolean;
  blocked_reason?: string | null;
}

export interface TuningActionAuditList {
  entries: TuningActionAuditEntry[];
}

export interface ScanPreset {
  id: number;
  name: string;
  min_profit?: number | null;
  min_roi?: number | null;
  max_buy_price?: number | null;
  min_confidence?: number | null;
  allow_stale: boolean;
  hide_risky: boolean;
  category_filter?: string | null;
}

export interface ItemSummary {
  item_id: number;
  name: string;
  undermine_url?: string | null;
  class_name?: string | null;
  subclass_name?: string | null;
  quality?: string | null;
  icon_url?: string | null;
  metadata_json?: Record<string, unknown> | null;
  metadata_updated_at?: string | null;
  is_commodity: boolean;
}

export interface ItemHistoryPoint {
  captured_at: string;
  lowest_price: number | null;
  average_price: number | null;
  quantity?: number | null;
  listing_count?: number | null;
}

export interface ItemRealmHistory {
  realm: string;
  points: ItemHistoryPoint[];
}

export interface TsmRegionStats {
  db_region_market_avg: number | null;
  db_region_historical: number | null;
  db_region_sale_avg: number | null;
  db_region_sale_rate: number | null;
  db_region_sold_per_day: number | null;
}

export interface TsmRealmStats {
  realm: string;
  min_buyout: number | null;
  num_auctions: number | null;
  market_value_recent: number | null;
  historical: number | null;
}

export interface TsmLedgerSale {
  realm: string;
  quantity: number | null;
  price: number | null;
  other_player?: string | null;
  player?: string | null;
  time?: string | null;
  source?: string | null;
}

export interface TsmLedgerSummary {
  auction_sale_count: number;
  auction_units_sold: number;
  auction_avg_unit_sale_price: number | null;
  last_auction_sale_at?: string | null;
  auction_buy_count: number;
  auction_units_bought: number;
  auction_avg_unit_buy_price: number | null;
  last_auction_buy_at?: string | null;
  cancel_count: number;
  expired_count: number;
  last_cancel_at?: string | null;
  last_expired_at?: string | null;
  recent_sales: TsmLedgerSale[];
}

export interface ItemDetail extends ItemSummary {
  metadata_status: "cached" | "live" | "missing";
  metadata_message?: string | null;
  latest_listings: ListingSnapshot[];
  auction_history: ItemRealmHistory[];
  tsm_status: "available" | "unavailable" | "error";
  tsm_message?: string | null;
  tsm_region_stats?: TsmRegionStats | null;
  tsm_realm_stats: TsmRealmStats[];
  tsm_ledger_status: "available" | "unavailable" | "error";
  tsm_ledger_message?: string | null;
  tsm_ledger_summary?: TsmLedgerSummary | null;
  recent_scan?: ScanResult | null;
}

export interface LiveListingRow {
  realm: string;
  lowest_price: number | null;
  average_price: number | null;
  quantity: number | null;
  listing_count: number | null;
  captured_at: string;
  source_name: string;
}

export interface LiveListingLookupResponse {
  provider_name: string;
  status: "available" | "unavailable" | "error";
  message: string;
  listings: LiveListingRow[];
}

export interface ListingImportPreviewRow {
  row_number: number;
  item_id: number;
  realm: string;
  lowest_price: number | null;
  average_price: number | null;
  quantity: number | null;
  listing_count: number | null;
  captured_at: string;
}

export interface ListingImportError {
  row_number: number;
  message: string;
}

export interface ListingImportResponse {
  committed: boolean;
  provider_name: string;
  accepted_count: number;
  inserted_count: number;
  skipped_duplicates: number;
  metadata_refreshed_count: number;
  preview_rows: ListingImportPreviewRow[];
  errors: ListingImportError[];
  untracked_realms: string[];
  coverage: {
    realm_count: number;
    unique_item_count: number;
    oldest_captured_at?: string | null;
    latest_captured_at?: string | null;
    enabled_realms_covered: number;
    missing_enabled_realms: string[];
  };
  summary?: string | null;
  warning?: string | null;
}

export interface ScannerFilters {
  minProfit: string;
  minRoi: string;
  maxBuyPrice: string;
  minConfidence: string;
  category: string;
  allowStale: boolean;
  hideRisky: boolean;
  sortBy: "final_score" | "estimated_profit" | "cheapest_buy_price" | "roi" | "confidence_score" | "sellability_score";
  sortDirection: "asc" | "desc";
}
