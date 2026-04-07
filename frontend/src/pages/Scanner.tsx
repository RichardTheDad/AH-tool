import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { refreshMissingMetadata } from "../api/items";
import { getPresets } from "../api/presets";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScanReadiness, getScanStatus, runScan } from "../api/scans";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { FilterSidebar } from "../components/filters/FilterSidebar";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { useScannerFilters } from "../hooks/useScannerFilters";
import type { ScanPreset } from "../types/models";
import { filterScanResults } from "../utils/filters";
import { formatDateTime } from "../utils/format";

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
  const { filters, updateFilters } = useScannerFilters();

  const scanQuery = useQuery({ queryKey: ["scans", "latest"], queryFn: getLatestScan });
  const readinessQuery = useQuery({ queryKey: ["scans", "readiness"], queryFn: getScanReadiness });
  const scanStatusQuery = useQuery({ queryKey: ["scans", "status"], queryFn: getScanStatus, refetchInterval: 2000 });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });

  const scanMutation = useMutation({
    mutationFn: runScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "readiness"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "status"] });
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
        queryClient.invalidateQueries({ queryKey: ["scans", "readiness"] });
        queryClient.invalidateQueries({ queryKey: ["scans", "status"] });
      }, 2500);
    },
  });
  const refreshMissingMetadataMutation = useMutation({
    mutationFn: refreshMissingMetadata,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "readiness"] });
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

  if (scanQuery.isLoading || readinessQuery.isLoading || scanStatusQuery.isLoading || providersQuery.isLoading || presetsQuery.isLoading || realmsQuery.isLoading) {
    return <LoadingState label="Loading scanner..." />;
  }

  if (scanQuery.error || readinessQuery.error || scanStatusQuery.error || providersQuery.error || presetsQuery.error || realmsQuery.error || !readiness || !scanStatus) {
    return <ErrorState message="Scanner data could not be loaded." />;
  }

  const latest = scanQuery.data?.latest ?? null;
  const results = filterScanResults(latest?.results ?? [], filters);
  const categoryOptions = Array.from(
    new Set((latest?.results ?? []).map((result) => result.item_class_name).filter((value): value is string => !!value)),
  ).sort((left, right) => left.localeCompare(right));
  const activePreset = (presetsQuery.data ?? []).find((preset) => matchesPreset(filters, preset)) ?? null;
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

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
      <FilterSidebar filters={filters} onChange={updateFilters} categoryOptions={categoryOptions} />

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
            {activeProvider ? (
              <p className={`mt-2 text-sm ${activeProvider.status === "error" ? "text-rose-700" : activeProvider.status === "cached_only" ? "text-amber-700" : "text-slate-600"}`}>
                {activeProvider.message}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.realms_with_data}/{readiness.enabled_realm_count} realms with data</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.realms_with_fresh_data} realms with fresh listings</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.unique_item_count} items in local coverage</span>
              {readiness.items_missing_metadata ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{readiness.items_missing_metadata} items missing metadata</span>
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
              onClick={() => refreshMissingMetadataMutation.mutate()}
              disabled={!readiness.items_missing_metadata || refreshMissingMetadataMutation.isPending || scanRunning}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshMissingMetadataMutation.isPending ? "Refreshing metadata..." : "Refresh missing metadata"}
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
              onClick={() => updateFilters(applyPresetToFilterState(preset))}
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

        {showGuidedEmptyState ? (
          <EmptyState title={emptyState.title} description={emptyState.description} />
        ) : latest ? (
          <ScannerTable
            results={results}
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            onSortChange={updateFilters}
          />
        ) : (
          <EmptyState title="Scanner is empty" description="Run the live Blizzard provider to pull fresh listings, or import listing snapshots as a fallback." />
        )}
      </div>
    </div>
  );
}
