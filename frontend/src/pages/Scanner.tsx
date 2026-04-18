import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDefaultPreset, getPresets } from "../api/presets";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScan, getScanCalibration, getScanHistory, getScanReadiness, getScanStatus } from "../api/scans";
import { applyTuningPreset, getTuningAudit } from "../api/settings";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { Button } from "../components/common/Button";
import { GoldAmount } from "../components/common/GoldAmount";
import { FilterSidebar } from "../components/filters/FilterSidebar";
import { ScannerStatusBar } from "../components/scanner/ScannerStatusBar";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { VirtualizedScannerList } from "../components/scanner/VirtualizedScannerList";
import { useAuth } from "../contexts/AuthContext";
import { useGuestPresets } from "../hooks/useGuestPresets";
import { useGuestRealms } from "../hooks/useGuestRealms";
import { useScannerFilters } from "../hooks/useScannerFilters";
import type { ScanPreset, ScanReadiness, ScanResult, ScanRuntimeStatus, ScanSession, ScanSessionSummary } from "../types/models";
import { ALL_REALMS_FILTER_VALUE, TRACKED_REALMS_FILTER_VALUE, filterScanResults } from "../utils/filters";
import { buildCategoryGroupsFromResults } from "../utils/itemCategories";
import { formatDateTime } from "../utils/format";
import { formatScore } from "../utils/format";
import { InfoTooltip } from "../components/common/InfoTooltip";
import { readinessTextColor } from "../utils/statusStyles";

const CALIBRATION_CHART_WIDTH = 640;
const CALIBRATION_CHART_HEIGHT = 180;
const CALIBRATION_CHART_PADDING = 14;
const TUNING_COOLDOWN_MS = 30 * 60 * 1000;
const SCHEDULE_INTERVAL_MINUTES_FALLBACK = 65;

interface ScannerNavigationState {
  restoreItemId?: number;
  restoreIndex?: number;
  restoredAt?: number;
}

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
    minSpread: "",
    maxSpread: "",
    maxBuyPrice: preset.max_buy_price?.toString() ?? "",
    minConfidence: preset.min_confidence?.toString() ?? "",
    category: preset.category_filter ?? "",
    subcategory: "",
    buyRealm: preset.buy_realms?.[0] ?? TRACKED_REALMS_FILTER_VALUE,
    sellRealm: preset.sell_realms?.[0] ?? TRACKED_REALMS_FILTER_VALUE,
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
    filters.subcategory === presetFilters.subcategory &&
    filters.buyRealm === presetFilters.buyRealm &&
    filters.sellRealm === presetFilters.sellRealm &&
    filters.hideRisky === presetFilters.hideRisky
  );
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueSortedRealms(values: string[]) {
  const byKey = new Map<string, string>();
  values.forEach((value) => {
    const realm = value.trim();
    if (!realm) {
      return;
    }
    const key = realm.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, realm);
    }
  });
  return Array.from(byKey.values()).sort((left, right) => left.localeCompare(right));
}

function normalizeSession(session: ScanSession | null | undefined): ScanSession | null {
  if (!session) {
    return null;
  }
  const results = asArray(session.results);
  return {
    ...session,
    warning_text: session.warning_text ?? null,
    result_count: typeof session.result_count === "number" ? session.result_count : results.length,
    results,
  };
}

export function Scanner() {
  const { user } = useAuth();
  const isGuest = !user;
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const guestPresets = useGuestPresets();
  const guestRealms = useGuestRealms();
  const scanRefreshIntervalMs = 60000;
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [selectedProvenanceResult, setSelectedProvenanceResult] = useState<ScanResult | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ itemId: number | null; index: number | null } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const { filters, updateFilters, restoreFiltersFromStorage } = useScannerFilters();
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = Boolean(
    filters.minProfit || filters.minRoi || filters.minSpread || filters.maxSpread ||
    filters.maxBuyPrice || filters.minConfidence || filters.category ||
    filters.subcategory || filters.buyRealm || filters.sellRealm || filters.hideRisky
  );

  const scanQuery = useQuery({
    queryKey: ["scans", "latest"],
    queryFn: () => getLatestScan(),
    refetchInterval: scanRefreshIntervalMs,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
  const scanHistoryQuery = useQuery({
    queryKey: ["scans", "history"],
    queryFn: getScanHistory,
    refetchInterval: scanRefreshIntervalMs,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const calibrationQuery = useQuery({ queryKey: ["scans", "calibration"], queryFn: getScanCalibration, refetchInterval: 15000, staleTime: 5 * 60 * 1000 });
  const tuningAuditQuery = useQuery({ queryKey: ["settings", "tuning-audit"], queryFn: () => getTuningAudit(8), refetchInterval: 15000, staleTime: 5 * 60 * 1000, enabled: !isGuest });
  const readinessQuery = useQuery({ queryKey: ["scans", "readiness"], queryFn: getScanReadiness, refetchInterval: 120000, staleTime: 30_000 });
  const scanStatusQuery = useQuery({ queryKey: ["scans", "status"], queryFn: getScanStatus, refetchInterval: scanRefreshIntervalMs, staleTime: 30_000 });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, enabled: !isGuest });
  const defaultPresetQuery = useQuery({ queryKey: ["presets", "default"], queryFn: getDefaultPreset, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, enabled: !isGuest });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, enabled: !isGuest });
  const previousScanId = (scanHistoryQuery.data?.scans ?? [])[1]?.id;
  const previousScanQuery = useQuery({
    queryKey: ["scans", previousScanId, "summary", 200],
    queryFn: () => getScan(previousScanId as number, 200),
    enabled: typeof previousScanId === "number",
  });
  const latest = normalizeSession(scanQuery.data?.latest);
  const recentScans: ScanSessionSummary[] = asArray(scanHistoryQuery.data?.scans);
  const fallbackScanId = latest?.result_count ? null : recentScans.find((scan) => scan.id !== latest?.id && scan.result_count > 0)?.id ?? null;
  const fallbackScanQuery = useQuery({
    queryKey: ["scans", fallbackScanId, "persisted", 500],
    queryFn: () => getScan(fallbackScanId as number, 500),
    enabled: typeof fallbackScanId === "number",
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
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
  const presets = isGuest ? guestPresets.presets : presetsQuery.data ?? [];
  const defaultPreset = isGuest ? guestPresets.defaultPreset : defaultPresetQuery.data;
  const trackedRealms = isGuest ? guestRealms.realms : realmsQuery.data ?? [];
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
      next_scheduled_at: null,
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

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    restoreFiltersFromStorage();
  }, [restoreFiltersFromStorage]);

  useEffect(() => {
    const state = location.state as ScannerNavigationState | null;
    const hasRestoreState = Boolean(
      state && (typeof state.restoreItemId === "number" || typeof state.restoreIndex === "number"),
    );
    if (!hasRestoreState) {
      return;
    }

    setRestoreTarget({
      itemId: typeof state?.restoreItemId === "number" ? state.restoreItemId : null,
      index: typeof state?.restoreIndex === "number" ? state.restoreIndex : null,
    });

    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  function handleFilterChange(next: Parameters<typeof updateFilters>[0]) {
    const changedKeys = Object.keys(next);
    const sortOnlyChange = changedKeys.every((key) => key === "sortBy" || key === "sortDirection");
    if (!sortOnlyChange) {
      setSelectedPresetId(null);
    }
    updateFilters(next);
  }

  const calibration = calibrationQuery.data;
  const previousScan = normalizeSession(previousScanQuery.data);
  const fallbackScan = normalizeSession(fallbackScanQuery.data);
  const persistedScan = latest?.result_count ? latest : fallbackScan ?? latest;
  const calibrationUnavailable = Boolean(calibrationQuery.error);
  const previousScanUnavailable = Boolean(previousScanQuery.error);
  const tuningAudit = isGuest ? [] : asArray(tuningAuditQuery.data?.entries);
  const scanResultRealmOptions = uniqueSortedRealms(
    asArray(persistedScan?.results).flatMap((result) => [result.cheapest_buy_realm, result.best_sell_realm]),
  );
  const enabledTrackedRealmOptions = uniqueSortedRealms(
    trackedRealms
      .filter((realm) => realm.enabled)
      .map((realm) => realm.realm_name),
  );
  const realmOptions = uniqueSortedRealms([
    ...enabledTrackedRealmOptions,
    ...scanResultRealmOptions,
  ]);
  const trackedRealmFilterOptions = enabledTrackedRealmOptions;
  const results = filterScanResults(asArray(persistedScan?.results), filters, { trackedRealms: trackedRealmFilterOptions });
  const useVirtualizedResults = results.length > 300 && !isMobileViewport;
  const categoryOptions = Array.from(
    new Set(asArray(persistedScan?.results).map((result) => result.item_class_name).filter((value): value is string => !!value)),
  ).sort((left, right) => left.localeCompare(right));
  const categoryGroups = buildCategoryGroupsFromResults(asArray(persistedScan?.results));
  const inferredPreset = presets.find((preset) => matchesPreset(filters, preset)) ?? null;
  const activePreset =
    presets.find((preset) => preset.id === selectedPresetId) ??
    (selectedPresetId === null ? inferredPreset : null);
  const latestWarningText = latest?.warning_text?.toLowerCase() ?? "";
  const showingPersistedResults = Boolean(persistedScan && latest && persistedScan.id !== latest.id && persistedScan.result_count > 0);
  const loadingPersistedScan = Boolean(!latest?.result_count && fallbackScanId && fallbackScanQuery.isLoading && !fallbackScanQuery.data);
  const showGuidedEmptyState =
    !loadingPersistedScan &&
    (!persistedScan || persistedScan.result_count === 0) &&
    (noEnabledRealms || noUsableListingData || latestWarningText.includes("no listing data found"));
  const focusedModeActive =
    (filters.buyRealm !== TRACKED_REALMS_FILTER_VALUE || filters.sellRealm !== TRACKED_REALMS_FILTER_VALUE) &&
    !(filters.buyRealm === ALL_REALMS_FILTER_VALUE && filters.sellRealm === ALL_REALMS_FILTER_VALUE);
  const focusedExcludedCount = Math.max(0, asArray(persistedScan?.results).length - results.length);

  const emptyState = noEnabledRealms
    ? {
        title: "No enabled realms",
        description: "Add at least one enabled realm before running the scanner.",
      }
    : noUsableListingData || latestWarningText.includes("no listing data found")
      ? {
          title: canBootstrapFromLiveProvider ? "No local listing cache yet" : "No listing data found",
          description: canBootstrapFromLiveProvider
            ? "Automatic scheduled scans will pull fresh Blizzard listings into the local cache."
            : "Live Blizzard listing refresh is not available right now. Check your Blizzard API credentials in Settings.",
        }
      : notEnoughRealmCoverage
        ? {
            title: "More realm coverage needed",
            description: "At least two enabled realms need listing data before the scanner can compare real cross-realm opportunities.",
          }
      : {
          title: "Scanner is empty",
          description: "Wait for the next scheduled scan cycle to pull fresh listings from the Blizzard Auction House.",
        };

  const diffSummary = (() => {
    if (!persistedScan || !previousScan || showingPersistedResults) {
      return null;
    }

    const previousByItem = new Map(previousScan.results.map((result, index) => [result.item_id, { result, rank: index + 1 }]));
    const currentByItem = new Map(persistedScan.results.map((result, index) => [result.item_id, { result, rank: index + 1 }]));

    const newItems = persistedScan.results
      .map((result, index) => ({ result, rank: index + 1 }))
      .filter(({ result }) => !previousByItem.has(result.item_id));
    const droppedItems = previousScan.results
      .map((result, index) => ({ result, rank: index + 1 }))
      .filter(({ result }) => !currentByItem.has(result.item_id));

    const sharedItems = persistedScan.results
      .map((result, index) => {
        const previous = previousByItem.get(result.item_id);
        if (!previous) {
          return null;
        }

        const rank = index + 1;
        const rankDelta = previous.rank - rank;
        const profitDelta = result.estimated_profit - previous.result.estimated_profit;
        const scoreDelta = result.final_score - previous.result.final_score;
        const roiDelta = result.roi - previous.result.roi;

        return {
          result,
          rank,
          previousRank: previous.rank,
          rankDelta,
          profitDelta,
          scoreDelta,
          roiDelta,
          className: result.item_class_name ?? "Unknown",
          cheapestBuyRealm: result.cheapest_buy_realm,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const movers = sharedItems
      .filter((entry) => entry.rankDelta !== 0)
      .sort((left, right) => Math.abs(right.rankDelta) - Math.abs(left.rankDelta));

    const profitChanged = sharedItems.filter((entry) => entry.profitDelta !== 0);
    const scoreChanged = sharedItems.filter((entry) => entry.scoreDelta !== 0);
    const roiChanged = sharedItems.filter((entry) => entry.roiDelta !== 0);
    const improvedRank = movers.filter((entry) => entry.rankDelta > 0);
    const declinedRank = movers.filter((entry) => entry.rankDelta < 0);

    const materiallyChanged = new Set<number>();
    newItems.forEach((entry) => materiallyChanged.add(entry.result.item_id));
    droppedItems.forEach((entry) => materiallyChanged.add(entry.result.item_id));
    sharedItems
      .filter((entry) => entry.rankDelta !== 0 || entry.profitDelta !== 0 || entry.scoreDelta !== 0 || entry.roiDelta !== 0)
      .forEach((entry) => materiallyChanged.add(entry.result.item_id));

    const classCounts = (rows: ScanResult[]) => {
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        const key = row.item_class_name ?? "Unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return counts;
    };

    const realmCounts = (rows: ScanResult[]) => {
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        const key = row.cheapest_buy_realm;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return counts;
    };

    const currentClassCounts = classCounts(persistedScan.results);
    const previousClassCounts = classCounts(previousScan.results);
    const classDeltas = Array.from(new Set([...currentClassCounts.keys(), ...previousClassCounts.keys()]))
      .map((name) => ({
        name,
        delta: (currentClassCounts.get(name) ?? 0) - (previousClassCounts.get(name) ?? 0),
      }))
      .filter((entry) => entry.delta !== 0)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 4);

    const currentRealmCounts = realmCounts(persistedScan.results);
    const previousRealmCounts = realmCounts(previousScan.results);
    const realmDeltas = Array.from(new Set([...currentRealmCounts.keys(), ...previousRealmCounts.keys()]))
      .map((realm) => ({
        realm,
        delta: (currentRealmCounts.get(realm) ?? 0) - (previousRealmCounts.get(realm) ?? 0),
      }))
      .filter((entry) => entry.delta !== 0)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 4);

    const totalComparedUniverse = new Set([
      ...persistedScan.results.map((result) => result.item_id),
      ...previousScan.results.map((result) => result.item_id),
    ]).size;

    const totalCurrent = persistedScan.results.length;
    const totalPrevious = previousScan.results.length;
    const netOpportunityDelta = totalCurrent - totalPrevious;
    const changedShare = totalComparedUniverse > 0 ? (materiallyChanged.size / totalComparedUniverse) * 100 : 0;
    const newShareOfCurrent = totalCurrent > 0 ? (newItems.length / totalCurrent) * 100 : 0;
    const droppedShareOfPrevious = totalPrevious > 0 ? (droppedItems.length / totalPrevious) * 100 : 0;
    const moverShareOfShared = sharedItems.length > 0 ? (movers.length / sharedItems.length) * 100 : 0;
    const averageMoverShift = movers.length > 0 ? movers.reduce((sum, entry) => sum + Math.abs(entry.rankDelta), 0) / movers.length : 0;

    return {
      currentGeneratedAt: persistedScan.generated_at,
      previousGeneratedAt: previousScan.generated_at,
      totalCurrent,
      totalPrevious,
      totalComparedUniverse,
      netOpportunityDelta,
      newItems,
      droppedItems,
      movers,
      improvedRank,
      declinedRank,
      profitChanged,
      scoreChanged,
      roiChanged,
      materiallyChangedCount: materiallyChanged.size,
      changedShare,
      newShareOfCurrent,
      droppedShareOfPrevious,
      moverShareOfShared,
      averageMoverShift,
      classDeltas,
      realmDeltas,
      topNewItems: newItems.slice(0, 4),
      topDroppedItems: droppedItems.slice(0, 4),
      topMovers: movers.slice(0, 4),
    };
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
  const nextScheduledScanLabel = (() => {
    if (scanStatus.next_scheduled_at) {
      return formatDateTime(scanStatus.next_scheduled_at);
    }
    if (persistedScan?.generated_at) {
      const baseMs = new Date(persistedScan.generated_at).getTime();
      if (Number.isFinite(baseMs)) {
        return formatDateTime(new Date(baseMs + SCHEDULE_INTERVAL_MINUTES_FALLBACK * 60 * 1000).toISOString());
      }
    }
    return null;
  })();

  useEffect(() => {
    if (!restoreTarget || useVirtualizedResults) {
      return;
    }
    const targetId = restoreTarget.itemId;
    if (typeof targetId !== "number") {
      setRestoreTarget(null);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`scanner-item-${targetId}`);
      if (element) {
        element.scrollIntoView({ block: "center", behavior: "instant" });
      }
      setRestoreTarget(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [restoreTarget, useVirtualizedResults]);

  return (
    <div className="space-y-4">
      {isGuest ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Guest mode is active. Scanner filters, tracked realms, and presets stay in this browser only. Sign in if you want them synced across devices.
        </div>
      ) : null}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-900/60 px-4 py-2.5 text-sm font-semibold text-zinc-200 shadow-sm backdrop-blur-xl transition hover:border-white/25 hover:text-zinc-100 active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
          </svg>
          {showFilters ? "Hide filters" : "Filters"}
          {hasActiveFilters && (
            <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
              !
            </span>
          )}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className={showFilters ? "block lg:block" : "hidden lg:block"}>
          <FilterSidebar
            filters={filters}
            onChange={handleFilterChange}
            categoryOptions={categoryOptions}
            categoryGroups={categoryGroups}
            realmOptions={realmOptions}
            onReset={() => updateFilters({ minProfit: "", minRoi: "", minSpread: "", maxSpread: "", maxBuyPrice: "", minConfidence: "", category: "", subcategory: "", buyRealm: TRACKED_REALMS_FILTER_VALUE, sellRealm: TRACKED_REALMS_FILTER_VALUE, hideRisky: false, sortBy: "final_score", sortDirection: "desc" })}
          />
        </div>

      <div className="space-y-4">
        <ScannerStatusBar 
          readiness={readiness}
          scanStatus={scanStatus}
          latestScan={persistedScan}
          showingPersistedResults={showingPersistedResults}
          nextScheduledScanLabel={nextScheduledScanLabel}
        />

        {focusedModeActive && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Focused mode is on. Showing {results.length} of {asArray(persistedScan?.results).length} opportunities; {focusedExcludedCount} hidden because they fall outside your selected buy/sell realms.
          </div>
        )}

        {presets.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/55 px-3 py-3 shadow-sm backdrop-blur-xl">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-zinc-100">
                {activePreset ? `Applied preset: ${activePreset.name}` : "Current view: Custom filters"}
              </p>
              {defaultPreset ? (
                <p className="text-xs text-zinc-400">Saved default: {defaultPreset.name}</p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {defaultPreset ? (
                <Button
                  variant={activePreset?.id === defaultPreset.id ? "primary" : "secondary"}
                  size="sm"
                  className="w-full sm:w-auto"
                  aria-pressed={activePreset?.id === defaultPreset.id}
                  onClick={() => {
                    setSelectedPresetId(defaultPreset.id);
                    updateFilters(applyPresetToFilterState(defaultPreset));
                  }}
                >
                  Apply default
                </Button>
              ) : null}
              {defaultPreset ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setSelectedPresetId(defaultPreset.id);
                    updateFilters(applyPresetToFilterState(defaultPreset));
                  }}
                >
                  Reset to saved default
                </Button>
              ) : null}
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={activePreset?.id === preset.id ? "primary" : "secondary"}
                  size="sm"
                  className="w-full sm:w-auto"
                  aria-pressed={activePreset?.id === preset.id}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    updateFilters(applyPresetToFilterState(preset));
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {calibrationQuery.isLoading ? (
          <LoadingState label="Loading calibration telemetry..." />
        ) : calibrationUnavailable ? (
          <ErrorState message="Calibration telemetry is temporarily unavailable." />
        ) : calibration && calibration.total_evaluated > 0 ? (
          <div className="rounded-3xl border border-white/15 bg-zinc-900/55 p-4 shadow-card backdrop-blur-xl">
            <h3 className="font-display text-lg font-semibold text-zinc-100">Calibration telemetry (30d)</h3>
            <p className="mt-1 text-sm text-zinc-300">{calibration.total_evaluated} evaluated predictions based on sell-realm follow-through, above-buy durability, and peak target capture.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500">Confidence bands</p>
                <div className="mt-2 space-y-1 text-sm text-zinc-300">
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
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500">Sellability bands</p>
                <div className="mt-2 space-y-1 text-sm text-zinc-300">
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
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500">Horizon buckets</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {calibration.horizons.map((horizon) => (
                    <div key={`h-${horizon.horizon_hours}`} className="rounded-xl border border-white/15 bg-zinc-900/65 px-3 py-2 text-sm text-zinc-300">
                      <p className="font-semibold text-zinc-100">{horizon.horizon_hours}h</p>
                      <p>{horizon.total_evaluated} evaluated</p>
                      <p>{Math.round(horizon.realized_rate * 100)}% hit target</p>
                      <p>{Math.round(horizon.profitable_rate * 100)}% stayed above buy</p>
                      <p>{Math.round(horizon.avg_target_capture * 100)}% avg target capture</p>
                      <p className="text-xs text-zinc-500">
                        Top confidence band: {horizon.confidence_bands[0] ? `${horizon.confidence_bands[0].band} (${Math.round(horizon.confidence_bands[0].realized_rate * 100)}%)` : "--"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {calibration.trends?.length ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500">Weekly confidence vs target-capture drift overlay</p>
                <div className="mt-2 rounded-xl border border-white/15 bg-zinc-900/65 p-3">
                  <svg viewBox={`0 0 ${CALIBRATION_CHART_WIDTH} ${CALIBRATION_CHART_HEIGHT}`} className="h-44 w-full">
                    <line x1={CALIBRATION_CHART_PADDING} y1={CALIBRATION_CHART_PADDING} x2={CALIBRATION_CHART_PADDING} y2={CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING} stroke="#52525b" strokeWidth="1" />
                    <line x1={CALIBRATION_CHART_PADDING} y1={CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING} x2={CALIBRATION_CHART_WIDTH - CALIBRATION_CHART_PADDING} y2={CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_PADDING} stroke="#52525b" strokeWidth="1" />
                    <polyline points={confidenceLine} fill="none" stroke="#60a5fa" strokeWidth="2" />
                    <polyline points={sellabilityLine} fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 4" />
                    <polyline points={realizedLine} fill="none" stroke="#34d399" strokeWidth="2.2" />
                  </svg>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400" />avg confidence</span>
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" />avg sellability</span>
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />avg target capture</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-zinc-300">
                  {calibration.trends.map((trend) => {
                    const driftPoints = Math.round((trend.avg_target_capture - trend.avg_confidence / 100) * 1000) / 10;
                    const driftLabel = driftPoints >= 0 ? `+${driftPoints}` : `${driftPoints}`;
                    return (
                      <div key={`trend-${trend.period_start}`} className="flex items-center justify-between gap-3">
                        <span>{formatDateTime(trend.period_start)}</span>
                        <span className={driftPoints < 0 ? "text-amber-300" : "text-emerald-300"}>
                          drift {driftLabel} pts • {Math.round(trend.profitable_rate * 100)}% above buy
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {calibration.suggestions?.length ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500">Auto-tuning suggestions</p>
                <div className="mt-2 space-y-2 text-sm">
                  {calibration.suggestions.map((suggestion, index) => (
                    <div key={`suggestion-${index}`} className="rounded-xl border border-white/15 bg-zinc-900/65 px-3 py-2">
                      <p className={suggestion.level === "warning" ? "text-amber-300" : "text-zinc-300"}>{suggestion.message}</p>
                      {suggestion.action_id && suggestion.action_label && !isGuest ? (
                        <button
                          type="button"
                          onClick={() => tuningMutation.mutate(suggestion.action_id as "safe_calibration" | "balanced_default")}
                          disabled={tuningMutation.isPending || tuningCooldownActive}
                          className="mt-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {tuningMutation.isPending
                            ? "Applying..."
                            : tuningCooldownActive
                              ? `Cooldown ${formatCooldown(tuningCooldownRemainingMs)}`
                              : suggestion.action_label}
                        </button>
                      ) : null}
                      {suggestion.action_id && suggestion.action_label && isGuest ? (
                        <p className="mt-2 text-xs text-zinc-500">Sign in to apply tuning suggestions.</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {tuningCooldownActive ? <p className="mt-2 text-xs text-amber-300">Tuning actions unlock in {formatCooldown(tuningCooldownRemainingMs)}.</p> : null}
                {tuningMutation.error ? <p className="mt-2 text-xs text-rose-300">{(tuningMutation.error as Error).message}</p> : null}
              </div>
            ) : null}

            {tuningAudit.length ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500">Tuning audit history</p>
                <div className="mt-2 space-y-1 text-sm text-zinc-300">
                  {tuningAudit.map((entry) => (
                    <div key={`audit-${entry.id}`} className="flex items-center justify-between gap-3">
                      <span>{formatDateTime(entry.applied_at)} • {entry.action_label}</span>
                      <span className={entry.blocked ? "text-amber-300" : "text-emerald-300"}>{entry.blocked ? (entry.blocked_reason ?? "blocked") : "applied"}</span>
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
              focusedModeActive={focusedModeActive}
              onOpenProvenance={setSelectedProvenanceResult}
              restoreItemId={restoreTarget?.itemId ?? null}
              restoreIndex={restoreTarget?.index ?? null}
              onRestoreComplete={() => setRestoreTarget(null)}
              allowItemNavigation={!isGuest}
            />
          ) : (
            <ScannerTable
              results={results}
              sortBy={filters.sortBy}
              sortDirection={filters.sortDirection}
              onSortChange={handleFilterChange}
              focusedModeActive={focusedModeActive}
              onOpenProvenance={setSelectedProvenanceResult}
              allowItemNavigation={!isGuest}
            />
          )
        ) : (
          <EmptyState title="Scanner is empty" description="Wait for the next scheduled scan cycle to pull fresh listings from the Blizzard Auction House." />
        )}

        {previousScanQuery.isLoading ? (
          <LoadingState label="Loading scan comparison..." />
        ) : previousScanUnavailable ? (
          <ErrorState message="Previous scan comparison is temporarily unavailable." />
        ) : diffSummary ? (
          <div className="rounded-3xl border border-white/15 bg-zinc-900/55 p-4 shadow-card backdrop-blur-xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-zinc-100">Since last scan</h3>
                <p className="mt-1 text-sm text-zinc-300">
                  Comparing {formatDateTime(diffSummary.currentGeneratedAt)} to {formatDateTime(diffSummary.previousGeneratedAt)}.
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                Compared {diffSummary.totalCurrent} current vs {diffSummary.totalPrevious} previous opportunities.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-3">
                <p className="text-xs uppercase tracking-label text-emerald-300">New opportunities</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-200">{diffSummary.newItems.length}</p>
                <p className="text-xs text-emerald-300">{diffSummary.newShareOfCurrent.toFixed(1)}% of current results</p>
              </div>

              <div className="rounded-2xl border border-rose-400/35 bg-rose-500/15 px-3 py-3">
                <p className="text-xs uppercase tracking-label text-rose-300">Dropped off</p>
                <p className="mt-1 text-2xl font-semibold text-rose-200">{diffSummary.droppedItems.length}</p>
                <p className="text-xs text-rose-300">{diffSummary.droppedShareOfPrevious.toFixed(1)}% of previous results</p>
              </div>

              <div className="rounded-2xl border border-amber-400/35 bg-amber-500/15 px-3 py-3">
                <p className="text-xs uppercase tracking-label text-amber-300 flex items-center gap-0.5">Rank movers<InfoTooltip text="Items that moved up or down in the ranked list since the last scan" /></p>
                <p className="mt-1 text-2xl font-semibold text-amber-200">{diffSummary.movers.length}</p>
                <p className="text-xs text-amber-300">
                  {diffSummary.moverShareOfShared.toFixed(1)}% of shared • avg shift {diffSummary.averageMoverShift.toFixed(1)}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-400/35 bg-sky-500/15 px-3 py-3">
                <p className="text-xs uppercase tracking-label text-sky-300 flex items-center gap-0.5">Materially changed<InfoTooltip text="Items where profit, ROI, or confidence score changed significantly between scans" /></p>
                <p className="mt-1 text-2xl font-semibold text-sky-200">{diffSummary.materiallyChangedCount}</p>
                <p className="text-xs text-sky-300">{diffSummary.changedShare.toFixed(1)}% of compared universe</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-xs uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Change composition<InfoTooltip text="Breakdown of how the result set changed since the last scan: newly ranked, dropped off, moved in rank, or stable" /></p>
                {diffSummary.totalComparedUniverse > 0 ? (
                  <>
                    <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${(diffSummary.newItems.length / diffSummary.totalComparedUniverse) * 100}%` }}
                        aria-label="Share of new opportunities"
                      />
                      <div
                        className="bg-rose-500"
                        style={{ width: `${(diffSummary.droppedItems.length / diffSummary.totalComparedUniverse) * 100}%` }}
                        aria-label="Share of dropped opportunities"
                      />
                      <div
                        className="bg-amber-500"
                        style={{ width: `${(diffSummary.movers.length / diffSummary.totalComparedUniverse) * 100}%` }}
                        aria-label="Share of rank movers"
                      />
                      <div
                        className="bg-zinc-500"
                        style={{ width: `${Math.max(0, (diffSummary.totalComparedUniverse - diffSummary.materiallyChangedCount) / diffSummary.totalComparedUniverse) * 100}%` }}
                        aria-label="Share with no material change"
                      />
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />new ({diffSummary.newItems.length})</div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />dropped ({diffSummary.droppedItems.length})</div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />rank moved ({diffSummary.movers.length})</div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-zinc-500" />stable ({Math.max(0, diffSummary.totalComparedUniverse - diffSummary.materiallyChangedCount)})</div>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">No comparable items yet.</p>
                )}

                <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/15 bg-zinc-900/65 px-2 py-2">
                    <p className="uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Net opportunity delta<InfoTooltip text="New opportunities minus dropped ones — positive means the market is growing, negative means it shrank" /></p>
                    <p className={diffSummary.netOpportunityDelta >= 0 ? "mt-1 font-semibold text-emerald-700" : "mt-1 font-semibold text-rose-700"}>
                      {diffSummary.netOpportunityDelta >= 0 ? `+${diffSummary.netOpportunityDelta}` : diffSummary.netOpportunityDelta}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-zinc-900/65 px-2 py-2">
                    <p className="uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Mover direction split<InfoTooltip text="Of the items that changed rank, how many improved (↑) vs. declined (↓)" /></p>
                    <p className="mt-1 font-semibold text-zinc-200">
                      <span className="text-emerald-700">↑ {diffSummary.improvedRank.length}</span>
                      <span className="mx-2 text-zinc-500">/</span>
                      <span className="text-rose-700">↓ {diffSummary.declinedRank.length}</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-zinc-900/65 px-2 py-2">
                    <p className="uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Profit deltas<InfoTooltip text="Items whose estimated profit changed between scans" /></p>
                    <p className="mt-1 font-semibold text-zinc-200">{diffSummary.profitChanged.length} changed</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-zinc-900/65 px-2 py-2">
                    <p className="uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Score / ROI deltas<InfoTooltip text="Items whose confidence score or return-on-investment percentage changed between scans" /></p>
                    <p className="mt-1 font-semibold text-zinc-200">{diffSummary.scoreChanged.length} / {diffSummary.roiChanged.length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Top movers<InfoTooltip text="Items with the biggest rank position change since the last scan" /></p>
                  <div className="mt-2 space-y-2 text-sm">
                    {diffSummary.topMovers.length ? diffSummary.topMovers.map((entry) => {
                      const maxShift = Math.max(1, Math.max(...diffSummary.topMovers.map((row) => Math.abs(row.rankDelta))));
                      const widthPct = (Math.abs(entry.rankDelta) / maxShift) * 100;
                      return (
                        <div key={`move-${entry.result.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-zinc-200">{entry.result.item_name}</span>
                            <span className={entry.rankDelta > 0 ? "shrink-0 font-semibold text-emerald-700" : "shrink-0 font-semibold text-rose-700"}>
                              {entry.rankDelta > 0 ? `↑ ${entry.rankDelta}` : `↓ ${Math.abs(entry.rankDelta)}`}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-zinc-800">
                            <div
                              className={entry.rankDelta > 0 ? "h-1.5 rounded-full bg-emerald-500" : "h-1.5 rounded-full bg-rose-500"}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }) : <p className="text-zinc-400">No rank movement yet.</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-xs uppercase tracking-label text-zinc-500 flex items-center gap-0.5">In / out highlights<InfoTooltip text="The specific items that newly appeared in or dropped out of the ranked opportunity list" /></p>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-label text-emerald-700">New</p>
                      {diffSummary.topNewItems.length ? diffSummary.topNewItems.map((entry) => (
                        <div key={`new-${entry.result.id}`} className="truncate text-zinc-300">{entry.result.item_name}</div>
                      )) : <div className="text-zinc-400">No new ranked items.</div>}
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-label text-rose-700">Dropped</p>
                      {diffSummary.topDroppedItems.length ? diffSummary.topDroppedItems.map((entry) => (
                        <div key={`drop-${entry.result.id}`} className="truncate text-zinc-300">{entry.result.item_name}</div>
                      )) : <div className="text-zinc-400">No items dropped off.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(diffSummary.classDeltas.length || diffSummary.realmDeltas.length) ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Class mix shift<InfoTooltip text="How the item class distribution (Armor, Weapon, Recipe, etc.) shifted between scans" /></p>
                  <div className="mt-1 space-y-1 text-xs text-zinc-300">
                    {diffSummary.classDeltas.length ? diffSummary.classDeltas.map((entry) => (
                      <div key={`class-${entry.name}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{entry.name}</span>
                        <span className={entry.delta > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                        </span>
                      </div>
                    )) : <div>No class distribution change.</div>}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs uppercase tracking-label text-zinc-500 flex items-center gap-0.5">Cheapest-buy realm shift<InfoTooltip text="Which realms are now the preferred cheapest place to buy, and how much that changed" /></p>
                  <div className="mt-1 space-y-1 text-xs text-zinc-300">
                    {diffSummary.realmDeltas.length ? diffSummary.realmDeltas.map((entry) => (
                      <div key={`realm-${entry.realm}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{entry.realm}</span>
                        <span className={entry.delta > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                        </span>
                      </div>
                    )) : <div>No cheapest-realm distribution change.</div>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedProvenanceResult ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-4">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-zinc-900/95 p-5 shadow-card backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-semibold text-zinc-100">Explination</h3>
                  <p className="mt-1 text-sm text-zinc-300">{selectedProvenanceResult.item_name} • {selectedProvenanceResult.cheapest_buy_realm} → {selectedProvenanceResult.best_sell_realm}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProvenanceResult(null)}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-sm font-semibold text-zinc-200"
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
                const keyStrengths: string[] = [];
                const watchouts: string[] = [];

                if ((selectedProvenanceResult.sellability_score ?? 0) >= 75) {
                  keyStrengths.push("Strong sell-side conditions for a likely turnover.");
                }
                if ((selectedProvenanceResult.confidence_score ?? 0) >= 75) {
                  keyStrengths.push("High confidence based on recent and consistent market signals.");
                }
                if ((selectedProvenanceResult.liquidity_score ?? 0) >= 70) {
                  keyStrengths.push("Good market depth supports smoother execution.");
                }

                if ((selectedProvenanceResult.bait_risk_score ?? 0) >= 55) {
                  watchouts.push("Higher bait-risk score suggests extra caution before posting.");
                }
                if (Boolean(evidence.gate_applied)) {
                  watchouts.push("Evidence guardrails were applied, which can cap upside when data quality is weaker.");
                }
                if (executionRiskReasons.length) {
                  watchouts.push(`Execution risk flags: ${executionRiskReasons.join(", ")}.`);
                }

                return (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      <p className="text-xs uppercase tracking-label text-zinc-500">Explanation</p>
                      <p className="mt-2">{selectedProvenanceResult.explanation}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      <p className="text-xs uppercase tracking-label text-zinc-500">Summary</p>
                      <p className="mt-2">
                        This rank blends expected profit (<GoldAmount value={selectedProvenanceResult.estimated_profit} />), return ({(selectedProvenanceResult.roi * 100).toFixed(1)}%), sellability ({formatScore(selectedProvenanceResult.sellability_score)}), and confidence ({formatScore(selectedProvenanceResult.confidence_score)}).
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-emerald-300">What looks good</p>
                        <div className="mt-2 space-y-1 text-sm text-emerald-100">
                          {keyStrengths.length ? keyStrengths.map((entry) => <p key={entry}>• {entry}</p>) : <p>• No standout strength signals were detected above the current thresholds.</p>}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-amber-300">What to watch</p>
                        <div className="mt-2 space-y-1 text-sm text-amber-100">
                          {watchouts.length ? watchouts.map((entry) => <p key={entry}>• {entry}</p>) : <p>• No major warnings were triggered by the current evidence checks.</p>}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-label text-zinc-500">Safety checks</p>
                      <div className="mt-2 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
                        <p>Sell depth check: {Boolean(evidence.sell_depth_ok) ? "Pass" : "Needs caution"}</p>
                        <p>History coverage: {Boolean(evidence.history_coverage_ok) ? "Pass" : "Needs caution"}</p>
                        <p>Realm turnover check: {Boolean(evidence.realm_turnover_ok) ? "Pass" : "Needs caution"}</p>
                        <p>Recency check: {Boolean(evidence.recency_ok) ? "Pass" : "Needs caution"}</p>
                      </div>
                      {gateReasons.length ? <p className="mt-2 text-sm text-zinc-400">Evidence gate reasons: {gateReasons.join(", ")}</p> : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-zinc-500">Raw components</p>
                        <div className="mt-2 space-y-1 text-sm text-zinc-300">
                          <p>Liquidity: {(components.liquidity ?? 0).toFixed(2)}</p>
                          <p>Volatility: {(components.volatility ?? 0).toFixed(2)}</p>
                          <p>Anti-bait: {(components.anti_bait ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-zinc-500">Confidence components</p>
                        <div className="mt-2 space-y-1 text-sm text-zinc-300">
                          {Object.entries(confidenceComponents).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-zinc-500">Final components</p>
                        <div className="mt-2 space-y-1 text-sm text-zinc-300">
                          {Object.entries(finalComponents).map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-label text-zinc-500">Adjustments</p>
                        <div className="mt-2 space-y-1 text-sm text-zinc-300">
                          {numericAdjustments.map(([key, value]) => (
                            <p key={key}>{key}: {Number(value ?? 0).toFixed(2)}</p>
                          ))}
                          {executionRiskReasons.length ? <p>Execution risk reasons: {executionRiskReasons.join(", ")}</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-label text-zinc-500">Evidence gate</p>
                      <div className="mt-2 space-y-1 text-sm text-zinc-300">
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
    </div>
  );
}
