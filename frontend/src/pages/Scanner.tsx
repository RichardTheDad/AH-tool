import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPresets } from "../api/presets";
import { getProviderStatus } from "../api/providers";
import { getLatestScan, runScan } from "../api/scans";
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

export function Scanner() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState("file_import");
  const { filters, updateFilters } = useScannerFilters();

  const scanQuery = useQuery({ queryKey: ["scans", "latest"], queryFn: getLatestScan });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets });

  const scanMutation = useMutation({
    mutationFn: runScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
    },
  });

  const providers = (providersQuery.data?.providers ?? []).filter((provider) => provider.provider_type === "listing");
  const scannerProviders = providers.filter(
    (provider) => provider.name === "file_import" || provider.status === "available" || provider.status === "cached_only",
  );
  const activeProvider = scannerProviders.find((provider) => provider.name === selectedProvider) ?? scannerProviders[0] ?? null;

  useEffect(() => {
    if (!activeProvider && scannerProviders[0]) {
      setSelectedProvider(scannerProviders[0].name);
    }
  }, [activeProvider, scannerProviders]);

  if (scanQuery.isLoading || providersQuery.isLoading || presetsQuery.isLoading) {
    return <LoadingState label="Loading scanner..." />;
  }

  if (scanQuery.error || providersQuery.error || presetsQuery.error) {
    return <ErrorState message="Scanner data could not be loaded." />;
  }

  const latest = scanQuery.data?.latest ?? null;
  const results = filterScanResults(latest?.results ?? [], filters);

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
      <FilterSidebar filters={filters} onChange={updateFilters} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Current opportunities</h2>
            <p className="mt-1 text-sm text-slate-600">{latest ? `Latest scan: ${formatDateTime(latest.generated_at)}` : "No scan recorded yet"}</p>
            {latest?.warning_text ? <p className="mt-2 text-sm text-amber-700">{latest.warning_text}</p> : null}
            {activeProvider ? (
              <p className={`mt-2 text-sm ${activeProvider.status === "error" ? "text-rose-700" : activeProvider.status === "cached_only" ? "text-amber-700" : "text-slate-600"}`}>
                {activeProvider.message}
              </p>
            ) : null}
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
              disabled={!activeProvider}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              {scanMutation.isPending ? "Running..." : "Run scan"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(presetsQuery.data ?? []).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => updateFilters(applyPresetToFilterState(preset))}
              className="rounded-full border border-brass/40 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {latest ? (
          <ScannerTable results={results} />
        ) : (
          <EmptyState title="Scanner is empty" description="Import real listing snapshots, then run the scanner to rank current opportunities." />
        )}
      </div>
    </div>
  );
}
