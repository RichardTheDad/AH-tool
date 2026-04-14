import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPresets } from "../api/presets";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScan, getScanCalibration, getScanHistory, getScanReadiness, getScanStatus, runScan } from "../api/scans";
import { applyTuningPreset, getTuningAudit } from "../api/settings";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { FilterSidebar } from "../components/filters/FilterSidebar";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { VirtualizedScannerList } from "../components/scanner/VirtualizedScannerList";
import { useScannerFilters } from "../hooks/useScannerFilters";
import type { ScanPreset, ScanResult } from "../types/models";
import { filterScanResults } from "../utils/filters";
import { formatDateTime } from "../utils/format";

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

function exportResultsAsCsv(rows: ReturnType<typeof filterScanResults>) {
  if (!rows.length) {
    return;
  }

  const header = [
    "Item",
    "Buy Realm",
    "Buy Price",
    "Sell Realm",
    "Sell Price",
    "Profit",
    "ROI",
    "Confidence",
    "Explanation",
  ];
  const csvRows = rows.map((row) => [
    row.item_name,
    row.cheapest_buy_realm,
    row.cheapest_buy_price,
    row.best_sell_realm,
    row.best_sell_price,
    row.estimated_profit,
    row.roi,
    row.confidence_score,
    row.explanation,
  ]);
  const csv = [header, ...csvRows]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "azerothfliplocal-scan-results.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

export function Scanner() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [selectedProvenanceResult, setSelectedProvenanceResult] = useState<ScanResult | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { filters, updateFilters } = useScannerFilters();

  const scanQuery = useQuery({ queryKey: ["scans", "latest"], queryFn: () => getLatestScan() });
  const scanHistoryQuery = useQuery({ queryKey: ["scans", "history"], queryFn: getScanHistory });
  const calibrationQuery = useQuery({ queryKey: ["scans", "calibration"], queryFn: getScanCalibration, refetchInterval: 15000 });
  const tuningAuditQuery = useQuery({ queryKey: ["settings", "tuning-audit"], queryFn: () => getTuningAudit(8), refetchInterval: 15000 });
  const readinessQuery = useQuery({ queryKey: ["scans", "readiness"], queryFn: getScanReadiness });
  const scanStatusQuery = useQuery({ queryKey: ["scans", "status"], queryFn: getScanStatus, refetchInterval: 4000 });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });
  const previousScanId = (scanHistoryQuery.data?.scans ?? [])[1]?.id;
  const previousScanQuery = useQuery({
    queryKey: ["scans", previousScanId, "summary", 200],
    queryFn: () => getScan(previousScanId as number, 200),
    enabled: typeof previousScanId === "number",
  });
  const coreQueriesLoading =
    scanQuery.isLoading ||
    scanHistoryQuery.isLoading ||
    readinessQuery.isLoading ||
    scanStatusQuery.isLoading ||
    providersQuery.isLoading ||
    presetsQuery.isLoading ||
    realmsQuery.isLoading;
  const coreQueriesErrored =
    scanQuery.error ||
    scanHistoryQuery.error ||
    readinessQuery.error ||
    scanStatusQuery.error ||
    providersQuery.error ||
    presetsQuery.error ||
    realmsQuery.error;

  const scanMutation = useMutation({
    mutationFn: runScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "history"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "readiness"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "status"] });
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
        queryClient.invalidateQueries({ queryKey: ["scans", "history"] });
        queryClient.invalidateQueries({ queryKey: ["scans", "readiness"] });
        queryClient.invalidateQueries({ queryKey: ["scans", "status"] });
      }, 2500);
    },
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
  const scannerProviders = [...providers]
    .filter((provider) => provider.name === "file_import" || provider.status === "available" || provider.status === "cached_only")
    .sort((left, right) => {
      const score = (provider: (typeof providers)[number]) =>
        (provider.supports_live_fetch && provider.available ? 4 : 0) +
        (provider.status === "cached_only" ? 2 : 0) +
        (provider.name === "file_import" ? 0 : 1);
      return score(right) - score(left);
    });
  const activeProvider = scannerProviders.find((provider) => provider.name === selectedProvider) ?? scannerProviders[0] ?? null;
  const readiness = readinessQuery.data;
  const scanStatus = scanStatusQuery.data;
  const noEnabledRealms = !!readiness && readiness.enabled_realm_count === 0;
  const noUsableListingData = !!readiness && readiness.enabled_realm_count > 0 && readiness.realms_with_data === 0;
  const notEnoughRealmCoverage = !!readiness && readiness.enabled_realm_count > 0 && readiness.realms_with_data < 2;
  const canBootstrapFromLiveProvider = !!activeProvider?.supports_live_fetch && activeProvider.available;
  const scanBlocked = noEnabledRealms || (!readiness?.ready_for_scan && !canBootstrapFromLiveProvider);
  const scanRunning = scanStatus?.status === "running";

  useEffect(() => {
    if (!activeProvider && scannerProviders[0]) {
      setSelectedProvider(scannerProviders[0].name);
    }
  }, [activeProvider, scannerProviders]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (coreQueriesLoading) {
    return <LoadingState label="Loading scanner..." />;
  }

  if (coreQueriesErrored || !readiness || !scanStatus) {
    return <ErrorState message="Scanner data could not be loaded." />;
  }

  function handleFilterChange(next: Parameters<typeof updateFilters>[0]) {
    const changedKeys = Object.keys(next);
    const sortOnlyChange = changedKeys.every((key) => key === "sortBy" || key === "sortDirection");
    if (!sortOnlyChange) {
      setSelectedPresetId(null);
    }
    updateFilters(next);
  }

  const latest = scanQuery.data?.latest ?? null;
  const calibration = calibrationQuery.data;
  const previousScan = previousScanQuery.data ?? null;
  const calibrationUnavailable = Boolean(calibrationQuery.error);
  const previousScanUnavailable = Boolean(previousScanQuery.error);
  const tuningAudit = tuningAuditQuery.data?.entries ?? [];
  const recentScans = scanHistoryQuery.data?.scans ?? [];
  const results = filterScanResults(latest?.results ?? [], filters);
  const useVirtualizedResults = results.length > 300;
  const hiddenByFilters = Math.max((latest?.results.length ?? 0) - results.length, 0);
  const categoryOptions = Array.from(
    new Set((latest?.results ?? []).map((result) => result.item_class_name).filter((value): value is string => !!value)),
  ).sort((left, right) => left.localeCompare(right));
  const inferredPreset = (presetsQuery.data ?? []).find((preset) => matchesPreset(filters, preset)) ?? null;
  const activePreset =
    (presetsQuery.data ?? []).find((preset) => preset.id === selectedPresetId) ??
    (selectedPresetId === null ? inferredPreset : null);
  const latestWarningText = latest?.warning_text?.toLowerCase() ?? "";
  const showGuidedEmptyState =
    (!latest || latest.result_count === 0) &&
    ((scanBlocked && !canBootstrapFromLiveProvider) || latestWarningText.includes("no listing data found"));

  const emptyState = noEnabledRealms
    ? {
        title: "No enabled realms",
        description: "Add at least one enabled realm before running the scanner.",
      }
    : noUsableListingData || latestWarningText.includes("no listing data found")
      ? {
          title: canBootstrapFromLiveProvider ? "No local listing cache yet" : "No listing data found",
          description: canBootstrapFromLiveProvider
            ? "Run the live provider once to pull fresh Blizzard listings into your local cache, or keep using imports as a fallback."
            : "Import listing snapshots for your enabled realms. Live bulk listing refresh is not available right now.",
        }
      : notEnoughRealmCoverage
        ? {
            title: "More realm coverage needed",
            description: "At least two enabled realms need listing data before the scanner can compare real cross-realm opportunities.",
          }
      : {
          title: "Scanner is empty",
          description: "Run the live Blizzard provider to pull fresh listings, or import listing snapshots as a fallback.",
        };

  const diffSummary = (() => {
    if (!latest || !previousScan) {
      return null;
    }
    const previousByItem = new Map(previousScan.results.map((result, index) => [result.item_id, { result, rank: index + 1 }]));
    const currentByItem = new Map(latest.results.map((result, index) => [result.item_id, { result, rank: index + 1 }]));
    const newItems = latest.results.filter((result) => !previousByItem.has(result.item_id)).slice(0, 4);
    const droppedItems = previousScan.results.filter((result) => !currentByItem.has(result.item_id)).slice(0, 4);
    const movers = latest.results
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
      .filter((entry): entry is { result: (typeof latest.results)[number]; change: number } => entry !== null && entry.change !== 0)
      .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
      .slice(0, 4);

    return { newItems, droppedItems, movers };
  })();

  const trendRows = calibration?.trends ?? [];
  const confidenceTrend = trendRows.map((trend) => trend.avg_confidence);
  const sellabilityTrend = trendRows.map((trend) => trend.avg_sellability);
  const realizedTrend = trendRows.map((trend) => trend.realized_rate * 100);
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
            <p className="mt-1 text-sm text-slate-600">{latest ? `Latest scan: ${formatDateTime(latest.generated_at)}` : "No scan recorded yet"}</p>
            {latest?.warning_text ? <p className="mt-2 text-sm text-amber-700">{latest.warning_text}</p> : null}
            <p className={`mt-2 text-sm ${readiness.status === "blocked" ? "text-rose-700" : readiness.status === "caution" ? "text-amber-700" : "text-emerald-700"}`}>
              {readiness.message}
            </p>
            {scanRunning ? <p className="mt-2 text-sm text-sky-700">{scanStatus.message}</p> : null}
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

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeProvider?.name ?? ""}
              onChange={(event) => setSelectedProvider(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {scannerProviders.map((provider) => (
                <option key={provider.name} value={provider.name}>
                  {provider.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                activeProvider &&
                scanMutation.mutate({
                  provider_name: activeProvider.name,
                  refresh_live: activeProvider.supports_live_fetch,
                  include_losers: false,
                })
              }
              disabled={!activeProvider || scanBlocked || scanMutation.isPending || scanRunning}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanMutation.isPending || scanRunning ? "Running..." : "Run scan"}
            </button>
            <button
              type="button"
              onClick={() => exportResultsAsCsv(results)}
              disabled={!results.length}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export CSV
            </button>
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

        {latest && hiddenByFilters > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {hiddenByFilters} results are currently hidden by your filters or preset. Loosen profit, confidence, or risky-item settings if you want to inspect why they fell out.
          </div>
        ) : null}

        {calibrationQuery.isLoading ? (
          <LoadingState label="Loading calibration telemetry..." />
        ) : calibrationUnavailable ? (
          <ErrorState message="Calibration telemetry is temporarily unavailable." />
        ) : calibration && calibration.total_evaluated > 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink">Calibration telemetry (30d)</h3>
            <p className="mt-1 text-sm text-slate-600">{calibration.total_evaluated} evaluated predictions based on sell-realm follow-through.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Confidence bands</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {calibration.confidence_bands.map((row) => (
                    <div key={`confidence-${row.band}`} className="flex items-center justify-between gap-3">
                      <span>{row.band}</span>
                      <span>{Math.round(row.realized_rate * 100)}% realized ({row.realized}/{row.total})</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Sellability bands</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {calibration.sellability_bands.map((row) => (
                    <div key={`sellability-${row.band}`} className="flex items-center justify-between gap-3">
                      <span>{row.band}</span>
                      <span>{Math.round(row.realized_rate * 100)}% realized ({row.realized}/{row.total})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {calibration.horizons?.length ? (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Horizon buckets</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {calibration.horizons.map((horizon) => (
                    <div key={`h-${horizon.horizon_hours}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="font-semibold text-ink">{horizon.horizon_hours}h</p>
                      <p>{horizon.total_evaluated} evaluated</p>
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
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weekly confidence vs realized drift overlay</p>
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
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />realized rate</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  {calibration.trends.map((trend) => {
                    const driftPoints = Math.round((trend.realized_rate - trend.avg_confidence / 100) * 1000) / 10;
                    const driftLabel = driftPoints >= 0 ? `+${driftPoints}` : `${driftPoints}`;
                    return (
                      <div key={`trend-${trend.period_start}`} className="flex items-center justify-between gap-3">
                        <span>{formatDateTime(trend.period_start)}</span>
                        <span className={driftPoints < 0 ? "text-amber-700" : "text-emerald-700"}>drift {driftLabel} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {calibration.suggestions?.length ? (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Auto-tuning suggestions</p>
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
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Tuning audit history</p>
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

        {showGuidedEmptyState ? (
          <EmptyState title={emptyState.title} description={emptyState.description} />
        ) : latest ? (
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
          <EmptyState title="Scanner is empty" description="Run the live Blizzard provider to pull fresh listings, or import listing snapshots as a fallback." />
        )}

        {previousScanQuery.isLoading ? (
          <LoadingState label="Loading scan comparison..." />
        ) : previousScanUnavailable ? (
          <ErrorState message="Previous scan comparison is temporarily unavailable." />
        ) : diffSummary ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink">Since last scan</h3>
            <p className="mt-1 text-sm text-slate-600">
              Comparing {formatDateTime(latest!.generated_at)} to {formatDateTime(previousScan!.generated_at)}.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">New opportunities</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {diffSummary.newItems.length ? diffSummary.newItems.map((item) => (
                    <div key={`new-${item.id}`}>{item.item_name}</div>
                  )) : <div>No new ranked items.</div>}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Biggest movers</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {diffSummary.movers.length ? diffSummary.movers.map(({ result, change }) => (
                    <div key={`move-${result.id}`}>
                      {result.item_name} {change > 0 ? `up ${change}` : `down ${Math.abs(change)}`}
                    </div>
                  )) : <div>No rank movement yet.</div>}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Dropped off</p>
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
                  adjustments?: Record<string, number>;
                  evidence?: Record<string, boolean | string[] | unknown>;
                };
                const components = provenance.components ?? {};
                const confidenceComponents = provenance.confidence_components ?? {};
                const finalComponents = provenance.final_components ?? {};
                const adjustments = provenance.adjustments ?? {};
                const evidence = provenance.evidence ?? {};
                const gateReasons = Array.isArray(evidence.gate_reasons) ? evidence.gate_reasons : [];

                return (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Components</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Liquidity: {(components.liquidity ?? 0).toFixed(2)}</p>
                          <p>Volatility: {(components.volatility ?? 0).toFixed(2)}</p>
                          <p>Anti-bait: {(components.anti_bait ?? 0).toFixed(2)}</p>
                          <p>Personal turnover: {(components.personal_turnover ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Confidence components</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {Object.entries(confidenceComponents).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Final components</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {Object.entries(finalComponents).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Adjustments</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {Object.entries(adjustments).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Evidence gate</p>
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
