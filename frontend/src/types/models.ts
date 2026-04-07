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
  item_quality?: string | null;
  item_class_name?: string | null;
  item_icon_url?: string | null;
  cheapest_buy_realm: string;
  cheapest_buy_price: number;
  best_sell_realm: string;
  best_sell_price: number;
  estimated_profit: number;
  roi: number;
  confidence_score: number;
  liquidity_score: number;
  volatility_score: number;
  bait_risk_score: number;
  final_score: number;
  explanation: string;
  sell_history_prices: number[];
  generated_at: string;
  has_stale_data: boolean;
  is_risky: boolean;
}

export interface ScanSession {
  id: number;
  provider_name: string;
  warning_text?: string | null;
  generated_at: string;
  result_count: number;
  results: ScanResult[];
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

export interface AppSettings {
  id: number;
  ah_cut_percent: number;
  flat_buffer: number;
  refresh_interval_minutes: number;
  stale_after_minutes: number;
  scoring_preset: "safe" | "balanced" | "aggressive";
  non_commodity_only: boolean;
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

export interface ItemDetail extends ItemSummary {
  metadata_status: "cached" | "live" | "missing";
  metadata_message?: string | null;
  latest_listings: ListingSnapshot[];
  tsm_status: "available" | "unavailable" | "error";
  tsm_message?: string | null;
  tsm_region_stats?: TsmRegionStats | null;
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
  sortBy: "final_score" | "estimated_profit" | "cheapest_buy_price" | "roi" | "confidence_score";
  sortDirection: "asc" | "desc";
}
