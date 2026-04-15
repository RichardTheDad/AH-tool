import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPresets } from "../api/presets";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScan, getScanCalibration, getScanHistory, getScanReadiness, getScanStatus } from "../api/scans";
import { applyTuningPreset, getTuningAudit } from "../api/settings";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { FilterSidebar } from "../components/filters/FilterSidebar";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { VirtualizedScannerList } from "../components/scanner/VirtualizedScannerList";
import { useScannerFilters } from "../hooks/useScannerFilters";
import type { ScanPreset, ScanReadiness, ScanResult, ScanRuntimeStatus } from "../types/models";
import { filterScanResults } from "../utils/filters";
import { formatDateTime } from "../utils/format";
import { readinessTextColor } from "../utils/statusStyles";

const CALIBRATION_CHART_WIDTH = 640;
const CALIBRATION_CHART_HEIGHT = 180;
const CALIBRATION_CHART_PADDING = 14;
const TUNING_COOLDOWN_MS = 30 * 60 * 1000;

function toPercentPoints(values: number[]) {
  if (!values.length) {
    return "";
  }
  const innerWidth = CALIBRATION_CHART_WIDTH - CALIBRATION_CHART_PADDING * 2;
  const innerHeight = CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING * 2;
  return values
    .map((value, index) => {
      const x = CALIBRATION_CHART_PADDING + (values.length > 1 ? (index / (values.length - 1)) * innerWidth : innerWidth / 2);
      const clamped = Math.max(0, Math.min(100, value));
      const y = CALIBRATION_CHART_PADDING + ((100 - clamped) / 100) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatCooldown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function applyPresetToFilterState(preset: ScanPreset) {
  return {
    minProfit: preset.min_profit?.toString() ?? "",
    minRoi: preset.min_roi?.toString() ?? "",
    maxBuyPrice: preset.max_buy_price?.toString() ?? "",
    minConfidence: preset.min_confidence?.toString() ?? "",
    category: preset.category_filter ?? "",
    allowStale: preset.allow_stale,
    hideRisky: preset.hide_risky,
  };
}

function matchesPreset(filters: ReturnType<typeof applyPresetToFilterState> & { sortBy?: string }, preset: ScanPreset) {
  const presetFilters = applyPresetToFilterState(preset);
  return (
    filters.minProfit === presetFilters.minProfit &&
    filters.minRoi === presetFilters.minRoi &&
    filters.maxBuyPrice === presetFilters.maxBuyPrice &&
    filters.minConfidence === presetFilters.minConfidence &&
    filters.category === presetFilters.category &&
    filters.allowStale === presetFilters.allowStale &&
    filters.hideRisky === presetFilters.hideRisky
  );
}

export function Scanner() {
  const queryClient = useQueryClient();
  const scanRefreshIntervalMs = 60000;
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [selectedProvenanceResult, setSelectedProvenanceResult] = useState<ScanResult | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { filters, updateFilters } = useScannerFilters();

  const scanQuery = useQuery({ queryKey: ["scans", "latest"], queryFn: () => getLatestScan(), refetchInterval: scanRefreshIntervalMs });
  const scanHistoryQuery = useQuery({ queryKey: ["scans", "history"], queryFn: getScanHistory, refetchInterval: scanRefreshIntervalMs });
  const calibrationQuery = useQuery({ queryKey: ["scans", "calibration"], queryFn: getScanCalibration, refetchInterval: 15000, staleTime: 5 * 60 * 1000 });
  const tuningAuditQuery = useQuery({ queryKey: ["settings", "tuning-audit"], queryFn: () => getTuningAudit(8), refetchInterval: 15000, staleTime: 5 * 60 * 1000 });
  const readinessQuery = useQuery({ queryKey: ["scans", "readiness"], queryFn: getScanReadiness });
  const scanStatusQuery = useQuery({ queryKey: ["scans", "status"], queryFn: getScanStatus, refetchInterval: scanRefreshIntervalMs });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });
  const previousScanId = (scanHistoryQuery.data?.scans ?? [])[1]?.id;
  const previousScanQuery = useQuery({
    queryKey: ["scans", previousScanId, "summary", 200],
    queryFn: () => getScan(previousScanId as number, 200),
    enabled: typeof previousScanId === "number",
  });
  const latest = scanQuery.data?.latest ?? null;
  const recentScans = scanHistoryQuery.data?.scans ?? [];
  const fallbackScanId = latest?.result_count ? null : recentScans.find((scan) => scan.id !== latest?.id && scan.result_count > 0)?.id ?? null;
  const fallbackScanQuery = useQuery({
    queryKey: ["scans", fallbackScanId, "persisted", 500],
    queryFn: () => getScan(fallbackScanId as number, 500),
    enabled: typeof fallbackScanId === "number",
  });
  const tuningMutation = useMutation({
    mutationFn: applyTuningPreset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "calibration"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "tuning-audit"] });
    },
  });
  const providers = (providersQuery.data?.providers ?? []).filter((provider) => provider.provider_type === "listing");
  const activeProvider = providers.find((p) => p.name === "blizzard_auctions") ?? providers[0] ?? null;
  const readinessLoaded = Boolean(readinessQuery.data);
  const readiness: ScanReadiness =
    readinessQuery.data ??
    {
      status: "caution",
      ready_for_scan: true,
      message: readinessQuery.isLoading
        ? "Checking scanner readiness..."
        : "Readiness telemetry is unavailable right now. You can still run a scan.",
      enabled_realm_count: 0,
      realms_with_data: 0,
      realms_with_fresh_data: 0,
      unique_item_count: 0,
      items_missing_metadata: 0,
      stale_realm_count: 0,
      missing_realms: [],
      stale_realms: [],
      oldest_snapshot_at: null,
      latest_snapshot_at: null,
      realms: [],
    };
  const scanStatus: ScanRuntimeStatus =
    scanStatusQuery.data ??
    {
      status: "idle",
      message: scanStatusQuery.isLoading ? "Checking scan runtime status..." : "Scan runtime status unavailable.",
      provider_name: null,
      started_at: null,
      finished_at: null,
    };
  const noEnabledRealms = readinessLoaded && readiness.enabled_realm_count === 0;
  const noUsableListingData = readinessLoaded && readiness.enabled_realm_count > 0 && readiness.realms_with_data === 0;
  const notEnoughRealmCoverage = readinessLoaded && readiness.enabled_realm_count > 0 && readiness.realms_with_data < 2;
  const canBootstrapFromLiveProvider = !!activeProvider?.supports_live_fetch && activeProvider.available;
  const scanRunning = scanStatus?.status === "running";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function handleFilterChange(next: Parameters<typeof updateFilters>[0]) {
    const changedKeys = Object.keys(next);
    const sortOnlyChange = changedKeys.every((key) => key === "sortBy" || key === "sortDirection");
    if (!sortOnlyChange) {
      setSelectedPresetId(null);
    }
    updateFilters(next);
  }

  const calibration = calibrationQuery.data;
  const previousScan = previousScanQuery.data ?? null;
  const persistedScan = latest?.result_count ? latest : fallbackScanQuery.data ?? latest;
  const calibrationUnavailable = Boolean(calibrationQuery.error);
  const previousScanUnavailable = Boolean(previousScanQuery.error);
  const tuningAudit = tuningAuditQuery.data?.entries ?? [];
  const results = filterScanResults(persistedScan?.results ?? [], filters);
  const useVirtualizedResults = results.length > 300;
  const categoryOptions = Array.from(
    new Set((persistedScan?.results ?? []).map((result) => result.item_class_name).filter((value): value is string => !!value)),
  ).sort((left, right) => left.localeCompare(right));
  const inferredPreset = (presetsQuery.data ?? []).find((preset) => matchesPreset(filters, preset)) ?? null;
  const activePreset =
    (presetsQuery.data ?? []).find((preset) => preset.id === selectedPresetId) ??
    (selectedPresetId === null ? inferredPreset : null);
  const latestWarningText = latest?.warning_text?.toLowerCase() ?? "";
  const showingPersistedResults = Boolean(persistedScan && latest && persistedScan.id !== latest.id && persistedScan.result_count > 0);
  const loadingPersistedScan = Boolean(!latest?.result_count && fallbackScanId && fallbackScanQuery.isLoading && !fallbackScanQuery.data);
  const showGuidedEmptyState =
    !loadingPersistedScan &&
    (!persistedScan || persistedScan.result_count === 0) &&
    (noEnabledRealms || noUsableListingData || latestWarningText.includes("no listing data found"));

  const emptyState = noEnabledRealms
    ? {
        title: "No enabled realms",
        description: "Add at least one enabled realm before running the scanner.",
      }
    : noUsableListingData || latestWarningText.includes("no listing data found")
      ? {
          title: canBootstrapFromLiveProvider ? "No local listing cache yet" : "No listing data found",
          description: canBootstrapFromLiveProvider
            ? "Run the scan to pull fresh Blizzard listings into the local cache."
            : "Live Blizzard listing refresh is not available right now. Check your Blizzard API credentials in Settings.",
        }
      : notEnoughRealmCoverage
        ? {
            title: "More realm coverage needed",
            description: "At least two enabled realms need listing data before the scanner can compare real cross-realm opportunities.",
          }
      : {
          title: "Scanner is empty",
          description: "Run the scan to pull fresh listings from the Blizzard Auction House.",
        };

  const diffSummary = (() => {
    if (!persistedScan || !previousScan || showingPersistedResults) {
      return null;
    }
    const previousByItem = new Map(previousScan.results.map((result, index) => [result.item_id, { result, rank: index + 1 }]));
    const currentByItem = new Map(persistedScan.results.map((result, index) => [result.item_id, { result, rank: index + 1 }]));
    const newItems = persistedScan.results.filter((result) => !previousByItem.has(result.item_id)).slice(0, 4);
    const droppedItems = previousScan.results.filter((result) => !currentByItem.has(result.item_id)).slice(0, 4);
    const movers = persistedScan.results
      .map((result, index) => {
        const previous = previousByItem.get(result.item_id);
        if (!previous) {
          return null;
        }
        return {
          result,
          change: previous.rank - (index + 1),
        };
      })
      .filter((entry): entry is { result: (typeof persistedScan.results)[number]; change: number } => entry !== null && entry.change !== 0)
      .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
      .slice(0, 4);

    return { newItems, droppedItems, movers };
  })();

  const trendRows = calibration?.trends ?? [];
  const confidenceTrend = trendRows.map((trend) => trend.avg_confidence);
  const sellabilityTrend = trendRows.map((trend) => trend.avg_sellability);
  const realizedTrend = trendRows.map((trend) => trend.avg_target_capture * 100);
  const confidenceLine = toPercentPoints(confidenceTrend);
  const sellabilityLine = toPercentPoints(sellabilityTrend);
  const realizedLine = toPercentPoints(realizedTrend);
  const latestAppliedTuning = tuningAudit.find((entry) => !entry.blocked) ?? null;
  const latestAppliedAtMs = latestAppliedTuning ? new Date(latestAppliedTuning.applied_at).getTime() : null;
  const tuningCooldownRemainingMs = latestAppliedAtMs ? Math.max(0, latestAppliedAtMs + TUNING_COOLDOWN_MS - nowMs) : 0;
  const tuningCooldownActive = tuningCooldownRemainingMs > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
      <FilterSidebar filters={filters} onChange={handleFilterChange} categoryOptions={categoryOptions} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Current opportunities</h2>
            <p className="mt-1 text-sm text-slate-600">{persistedScan ? `Showing results from ${formatDateTime(persistedScan.generated_at)}` : "No scan recorded yet"}</p>
            {showingPersistedResults ? <p className="mt-2 text-sm text-slate-500">Newest scan is still saved, but it returned no listings, so the last populated scan remains visible.</p> : null}
            {latest?.warning_text ? <p className="mt-2 text-sm text-amber-700">{latest.warning_text}</p> : null}
            <p className={`mt-2 text-sm ${readinessTextColor(readiness.status)}`}>
              {readiness.message}
            </p>
            {scanRunning ? (
              <div className="mt-2 flex items-start gap-2">
                <span className="mt-0.5 inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                <div>
                  <p className="text-sm font-medium text-sky-700">Scanning…</p>
                  {scanStatus.message ? (
                    <p className="mt-0.5 text-xs text-sky-600">{scanStatus.message}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!scanRunning && scanStatus.finished_at ? (
              <p className="mt-2 text-sm text-slate-500">Last scan update: {formatDateTime(scanStatus.finished_at)}</p>
            ) : null}
            {activeProvider ? (
              <p className={`mt-2 text-sm ${activeProvider.status === "error" ? "text-rose-700" : activeProvider.status === "cached_only" ? "text-amber-700" : "text-slate-600"}`}>
                {activeProvider.message}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.realms_with_data}/{readiness.enabled_realm_count} realms with data</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.realms_with_fresh_data} realms with fresh listings</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.unique_item_count} items in local coverage</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{recentScans.length} recent scans saved</span>
              {readiness.items_missing_metadata ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  {readiness.items_missing_metadata} items missing metadata; automatic sweep active
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(presetsQuery.data ?? []).map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset?.id === preset.id}
              onClick={() => {
                setSelectedPresetId(preset.id);
                updateFilters(applyPresetToFilterState(preset));
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                activePreset?.id === preset.id
                  ? "border-ink bg-ink text-white"
                  : "border-brass/40 bg-white/80 text-slate-700 hover:border-brass/70"
              }`}
            >
              {preset.name}
            </button>
          ))}
          {activePreset ? (
            <span className="self-center text-sm text-slate-600">Applied preset: {activePreset.name}</span>
          ) : null}
        </div>

        {(latest?.results?.length ?? 0) ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Filter controls now reprioritize the list instead of removing rows, so weaker matches stay visible lower in the rankings.
          </div>
        ) : null}

        {calibrationQuery.isLoading ? (
          <LoadingState label="Loading calibration telemetry..." />
        ) : calibrationUnavailable ? (
          <ErrorState message="Calibration telemetry is temporarily unavailable." />
        ) : calibration && calibration.total_evaluated > 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink">Calibration telemetry (30d)</h3>
            <p className="mt-1 text-sm text-slate-600">{calibration.total_evaluated} evaluated predictions based on sell-realm follow-through, above-buy durability, and peak target capture.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Confidence bands</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {calibration.confidence_bands.map((row) => (
                    <div key={`confidence-${row.band}`} className="flex items-center justify-between gap-3">
                      <span>{row.band}</span>
                      <span>
                        {Math.round(row.realized_rate * 100)}% hit target, {Math.round(row.profitable_rate * 100)}% stayed above buy, {Math.round(row.avg_target_capture * 100)}% avg capture
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Sellability bands</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {calibration.sellability_bands.map((row) => (
                    <div key={`sellability-${row.band}`} className="flex items-center justify-between gap-3">
                      <span>{row.band}</span>
                      <span>
                        {Math.round(row.realized_rate * 100)}% hit target, {Math.round(row.profitable_rate * 100)}% stayed above buy, {Math.round(row.avg_target_capture * 100)}% avg capture
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {calibration.horizons?.length ? (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Horizon buckets</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {calibration.horizons.map((horizon) => (
                    <div key={`h-${horizon.horizon_hours}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="font-semibold text-ink">{horizon.horizon_hours}h</p>
                      <p>{horizon.total_evaluated} evaluated</p>
                      <p>{Math.round(horizon.realized_rate * 100)}% hit target</p>
                      <p>{Math.round(horizon.profitable_rate * 100)}% stayed above buy</p>
                      <p>{Math.round(horizon.avg_target_capture * 100)}% avg target capture</p>
                      <p className="text-xs text-slate-500">
                        Top confidence band: {horizon.confidence_bands[0] ? `${horizon.confidence_bands[0].band} (${Math.round(horizon.confidence_bands[0].realized_rate * 100)}%)` : "--"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {calibration.trends?.length ? (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Weekly confidence vs target-capture drift overlay</p>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                  <svg viewBox={`0 0 ${CALIBRATION_CHART_WIDTH} ${CALIBRATION_CHART_HEIGHT}`} className="h-44 w-full">
                    <line x1={CALIBRATION_CHART_PADDING} y1={CALIBRATION_CHART_PADDING} x2={CALIBRATION_CHART_PADDING} y2={CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING} stroke="#cbd5e1" strokeWidth="1" />
                    <line x1={CALIBRATION_CHART_PADDING} y1={CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING} x2={CALIBRATION_CHART_WIDTH - CALIBRATION_CHART_PADDING} y2={CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING} stroke="#cbd5e1" strokeWidth="1" />
                    <polyline points={confidenceLine} fill="none" stroke="#1d4ed8" strokeWidth="2" />
                    <polyline points={sellabilityLine} fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="5 4" />
                    <polyline points={realizedLine} fill="none" stroke="#059669" strokeWidth="2.2" />
                  </svg>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-700" />avg confidence</span>
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-600" />avg sellability</span>
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />avg target capture</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  {calibration.trends.map((trend) => {
                    const driftPoints = Math.round((trend.avg_target_capture - trend.avg_confidence / 100) * 1000) / 10;
                    const driftLabel = driftPoints >= 0 ? `+${driftPoints}` : `${driftPoints}`;
                    return (
                      <div key={`trend-${trend.period_start}`} className="flex items-center justify-between gap-3">
                        <span>{formatDateTime(trend.period_start)}</span>
                        <span className={driftPoints < 0 ? "text-amber-700" : "text-emerald-700"}>
                          drift {driftLabel} pts • {Math.round(trend.profitable_rate * 100)}% above buy
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {calibration.suggestions?.length ? (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Auto-tuning suggestions</p>
                <div className="mt-2 space-y-2 text-sm">
                  {calibration.suggestions.map((suggestion, index) => (
                    <div key={`suggestion-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className={suggestion.level === "warning" ? "text-amber-800" : "text-slate-700"}>{suggestion.message}</p>
                      {suggestion.action_id && suggestion.action_label ? (
                        <button
                          type="button"
                          onClick={() => tuningMutation.mutate(suggestion.action_id as "safe_calibration" | "balanced_default")}
                          disabled={tuningMutation.isPending || tuningCooldownActive}
                          className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {tuningMutation.isPending
                            ? "Applying..."
                            : tuningCooldownActive
                              ? `Cooldown ${formatCooldown(tuningCooldownRemainingMs)}`
                              : suggestion.action_label}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {tuningCooldownActive ? <p className="mt-2 text-xs text-amber-700">Tuning actions unlock in {formatCooldown(tuningCooldownRemainingMs)}.</p> : null}
                {tuningMutation.error ? <p className="mt-2 text-xs text-rose-700">{(tuningMutation.error as Error).message}</p> : null}
              </div>
            ) : null}

            {tuningAudit.length ? (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Tuning audit history</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {tuningAudit.map((entry) => (
                    <div key={`audit-${entry.id}`} className="flex items-center justify-between gap-3">
                      <span>{formatDateTime(entry.applied_at)} • {entry.action_label}</span>
                      <span className={entry.blocked ? "text-amber-700" : "text-emerald-700"}>{entry.blocked ? (entry.blocked_reason ?? "blocked") : "applied"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {loadingPersistedScan ? (
          <LoadingState label="Loading last populated scan..." />
        ) : showGuidedEmptyState ? (
          <EmptyState title={emptyState.title} description={emptyState.description} />
        ) : persistedScan ? (
          useVirtualizedResults ? (
            <VirtualizedScannerList
              results={results}
              sortBy={filters.sortBy}
              sortDirection={filters.sortDirection}
              onSortChange={handleFilterChange}
              onOpenProvenance={setSelectedProvenanceResult}
            />
          ) : (
            <ScannerTable
              results={results}
              sortBy={filters.sortBy}
              sortDirection={filters.sortDirection}
              onSortChange={handleFilterChange}
              onOpenProvenance={setSelectedProvenanceResult}
            />
          )
        ) : (
          <EmptyState title="Scanner is empty" description="Run the scan to pull fresh listings from the Blizzard Auction House." />
        )}

        {previousScanQuery.isLoading ? (
          <LoadingState label="Loading scan comparison..." />
        ) : previousScanUnavailable ? (
          <ErrorState message="Previous scan comparison is temporarily unavailable." />
        ) : diffSummary ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink">Since last scan</h3>
            <p className="mt-1 text-sm text-slate-600">
              Comparing {formatDateTime(persistedScan!.generated_at)} to {formatDateTime(previousScan!.generated_at)}.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">New opportunities</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {diffSummary.newItems.length ? diffSummary.newItems.map((item) => (
                    <div key={`new-${item.id}`}>{item.item_name}</div>
                  )) : <div>No new ranked items.</div>}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Biggest movers</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {diffSummary.movers.length ? diffSummary.movers.map(({ result, change }) => (
                    <div key={`move-${result.id}`}>
                      {result.item_name} {change > 0 ? `up ${change}` : `down ${Math.abs(change)}`}
                    </div>
                  )) : <div>No rank movement yet.</div>}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-slate-500">Dropped off</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {diffSummary.droppedItems.length ? diffSummary.droppedItems.map((item) => (
                    <div key={`drop-${item.id}`}>{item.item_name}</div>
                  )) : <div>No items dropped off.</div>}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {recentScans.length ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink">Recent scans</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {recentScans.map((scan) => (
                <div key={scan.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <div className="font-semibold text-ink">{scan.provider_name}</div>
                  <div className="mt-1">{formatDateTime(scan.generated_at)}</div>
                  <div className="mt-1 text-slate-500">{scan.result_count} ranked results</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedProvenanceResult ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/70 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink">Score provenance drilldown</h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedProvenanceResult.item_name} • {selectedProvenanceResult.cheapest_buy_realm} → {selectedProvenanceResult.best_sell_realm}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProvenanceResult(null)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>

              {(() => {
                const provenance = (selectedProvenanceResult.score_provenance ?? {}) as {
                  components?: Record<string, number>;
                  confidence_components?: Record<string, number>;
                  final_components?: Record<string, number>;
                  adjustments?: Record<string, unknown>;
                  evidence?: Record<string, boolean | string[] | unknown>;
                };
                const components = provenance.components ?? {};
                const confidenceComponents = provenance.confidence_components ?? {};
                const finalComponents = provenance.final_components ?? {};
                const adjustments = provenance.adjustments ?? {};
                const evidence = provenance.evidence ?? {};
                const gateReasons = Array.isArray(evidence.gate_reasons) ? evidence.gate_reasons : [];
                const numericAdjustments = Object.entries(adjustments).filter(([, value]) => typeof value === "number");
                const executionRiskReasons = Array.isArray(adjustments.execution_risk_reasons)
                  ? adjustments.execution_risk_reasons.filter((value): value is string => typeof value === "string")
                  : [];

                return (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-slate-500">Components</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Liquidity: {(components.liquidity ?? 0).toFixed(2)}</p>
                          <p>Volatility: {(components.volatility ?? 0).toFixed(2)}</p>
                          <p>Anti-bait: {(components.anti_bait ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-slate-500">Confidence components</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {Object.entries(confidenceComponents).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-slate-500">Final components</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {Object.entries(finalComponents).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-slate-500">Adjustments</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {numericAdjustments.map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                          {executionRiskReasons.length ? <p>Execution risk reasons: {executionRiskReasons.join(", ")}</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-label text-slate-500">Evidence gate</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        <p>Applied: {String(Boolean(evidence.gate_applied))}</p>
                        <p>Sell depth OK: {String(Boolean(evidence.sell_depth_ok))}</p>
                        <p>History coverage OK: {String(Boolean(evidence.history_coverage_ok))}</p>
                        <p>Realm turnover OK: {String(Boolean(evidence.realm_turnover_ok))}</p>
                        <p>Recency OK: {String(Boolean(evidence.recency_ok))}</p>
                        {gateReasons.length ? <p>Reasons: {gateReasons.join(", ")}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
