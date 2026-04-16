import { useEffect, useMemo, useRef, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { Link, useLocation } from "react-router-dom";
import type { ScanResult, ScannerFilters } from "../../types/models";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import { GoldAmount } from "../common/GoldAmount";
import { ScoreDial } from "../common/ScoreDial";
import { formatPercent, formatScore } from "../../utils/format";
import { getSafeItemIconUrl, getSafeUndermineUrl } from "../../utils/safeUrl";

interface VirtualizedScannerListProps {
  results: ScanResult[];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: (next: { sortBy: ScannerFilters["sortBy"]; sortDirection: ScannerFilters["sortDirection"] }) => void;
  focusedModeActive?: boolean;
  onOpenProvenance?: (result: ScanResult) => void;
  restoreItemId?: number | null;
  restoreIndex?: number | null;
  onRestoreComplete?: () => void;
}

type ListRefApi = {
  readonly element: HTMLDivElement | null;
  scrollToRow: (config: {
    align?: "auto" | "center" | "end" | "smart" | "start";
    behavior?: "auto" | "instant" | "smooth";
    index: number;
  }) => void;
};

function SortButton({
  label,
  column,
  sortBy,
  sortDirection,
  onSortChange,
}: {
  label: string;
  column: ScannerFilters["sortBy"];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: VirtualizedScannerListProps["onSortChange"];
}) {
  const active = sortBy === column;
  const indicator = !active ? "" : sortDirection === "desc" ? " v" : " ^";

  return (
    <button
      type="button"
      onClick={() =>
        onSortChange({
          sortBy: column,
          sortDirection: active && sortDirection === "desc" ? "asc" : "desc",
        })
      }
      className="mx-auto block text-center transition hover:text-zinc-100"
      aria-pressed={active}
    >
      {label}
      {indicator}
    </button>
  );
}

function summarizeMoverLikelihood(result: ScanResult) {
  if (result.sellability_score >= 80 && result.confidence_score >= 75 && !result.is_risky) return "likely mover";
  if (result.sellability_score >= 65 && result.confidence_score >= 60) return "tradable";
  if (result.sellability_score >= 45) return "speculative";
  return "slow seller";
}

function summarizeProvenance(result: ScanResult) {
  const provenance = result.score_provenance as {
    components?: Record<string, number>;
    evidence?: Record<string, boolean>;
    adjustments?: Record<string, unknown>;
  } | null | undefined;
  if (!provenance?.components) {
    return null;
  }
  return {
    liquidity: provenance.components.liquidity,
    volatility: provenance.components.volatility,
    antiBait: provenance.components.anti_bait,
    gateApplied: Boolean(provenance.evidence?.gate_applied),
    executionRiskReasons: Array.isArray(provenance.adjustments?.execution_risk_reasons)
      ? provenance.adjustments.execution_risk_reasons.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function isEvidenceGated(result: ScanResult) {
  const provenance = result.score_provenance as { evidence?: Record<string, boolean> } | null | undefined;
  return Boolean(provenance?.evidence?.gate_applied);
}

function ItemIcon({ result }: { result: ScanResult }) {
  const iconUrl = getSafeItemIconUrl(result.item_icon_url);
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        className="h-11 w-11 shrink-0 rounded-lg border border-white/15 bg-zinc-900/65 object-cover"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-zinc-900/65 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
      --
    </div>
  );
}

function Row({ index, style, results, onOpenProvenance, search, focusedModeActive }: RowComponentProps<{ results: ScanResult[]; onOpenProvenance?: (result: ScanResult) => void; search: string; focusedModeActive?: boolean }>) {
  const result = results[index];
  const provenance = summarizeProvenance(result);
  const gated = isEvidenceGated(result);

  return (
    <div style={style} className="overflow-hidden border-b border-white/10 px-4 py-2.5">
      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] items-center gap-3 text-sm">
        <div className="min-w-0">
          <div className="flex gap-2.5">
            <ItemIcon result={result} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={`/app/items/${result.item_id}`}
                  state={{
                    from: "scanner",
                    scannerSearch: search,
                    restoreItemId: result.item_id,
                    restoreIndex: index,
                  }}
                  className="text-[14px] font-semibold leading-[1.25] text-zinc-100 underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                >
                  {result.item_name}
                </Link>
                {getSafeUndermineUrl(result.undermine_url) ? (
                  <a
                    href={getSafeUndermineUrl(result.undermine_url)!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold uppercase tracking-link text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline"
                  >
                    Undermine
                  </a>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-[1.3] text-zinc-300">{result.explanation}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{focusedModeActive ? "Focused realm scope" : "Discovery mode across all enabled realms"}</p>
              {provenance ? (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="min-w-0 truncate">
                    Signals L {provenance.liquidity?.toFixed?.(1) ?? "--"}, V {provenance.volatility?.toFixed?.(1) ?? "--"}, Anti-bait {provenance.antiBait?.toFixed?.(1) ?? "--"}
                    {provenance.gateApplied ? " | evidence gate" : ""}
                    {provenance.executionRiskReasons.length ? ` | execution risk: ${provenance.executionRiskReasons.slice(0, 2).join(", ")}` : ""}
                  </span>
                  {onOpenProvenance ? (
                    <button
                      type="button"
                      onClick={() => onOpenProvenance(result)}
                      className="shrink-0 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200"
                    >
                      Why ranked
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
                {result.is_risky ? <Badge tone="danger">Risky</Badge> : <Badge tone="success">Stable</Badge>}
                {gated ? <Badge tone="warning">Evidence gate</Badge> : null}
                <Badge tone={summarizeMoverLikelihood(result) === "likely mover" ? "success" : "warning"}>{summarizeMoverLikelihood(result)}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 text-center text-zinc-300">
          <div className="font-medium">{result.cheapest_buy_realm}</div>
          <div><GoldAmount value={result.cheapest_buy_price} /></div>
        </div>

        <div className="min-w-0 text-center text-zinc-300">
          <div className="font-medium">{result.best_sell_realm}</div>
          <div><GoldAmount value={result.best_sell_price} /></div>
          {result.observed_sell_price != null ? <div className="text-xs text-zinc-500">Obs <GoldAmount value={result.observed_sell_price} /></div> : null}
        </div>

        <div className="min-w-0 text-center">
          <div className="font-semibold text-emerald-700"><GoldAmount value={result.estimated_profit} /></div>
          <div className="text-zinc-300">{formatPercent(result.roi)}</div>
        </div>

        <div className="min-w-0 text-center text-zinc-300">
          <div>{formatPercent(result.spread_percent)}</div>
          {result.spread_absolute != null ? <div className="text-xs text-zinc-500"><GoldAmount value={result.spread_absolute} /></div> : null}
          {result.sale_average_spread_percent != null ? <div className="text-xs text-zinc-500">Avg {formatPercent(result.sale_average_spread_percent)}</div> : null}
        </div>

        <div className="min-w-0">
          <div className="flex justify-center">
          <ScoreDial
            score={result.confidence_score}
            title={`Confidence ${formatScore(result.confidence_score)} | Sellability ${formatScore(result.sellability_score)}`}
          />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-col items-center gap-1">
            <ScoreDial
              score={result.sellability_score}
              title={`Sellability ${formatScore(result.sellability_score)} | Turnover ${result.turnover_label}${gated ? " | evidence gate active" : ""}`}
            />
            <span className="text-[10px] uppercase tracking-label text-zinc-500">{result.turnover_label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VirtualizedScannerList({
  results,
  sortBy,
  sortDirection,
  onSortChange,
  focusedModeActive = false,
  onOpenProvenance,
  restoreItemId = null,
  restoreIndex = null,
  onRestoreComplete,
}: VirtualizedScannerListProps) {
  const location = useLocation();
  const [height, setHeight] = useState(560);
  const listRef = useRef<ListRefApi | null>(null);
  const lastRestoreKeyRef = useRef<string | null>(null);
  const search = useMemo(() => location.search, [location.search]);

  useEffect(() => {
    const updateHeight = () => {
      const viewportHeight = window.innerHeight || 900;
      const next = Math.min(860, Math.max(420, viewportHeight - 260));
      setHeight(next);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (!results.length) {
      return;
    }
    if (restoreItemId === null && restoreIndex === null) {
      return;
    }

    const resolvedIndex = (() => {
      if (typeof restoreItemId === "number") {
        const fromId = results.findIndex((result) => result.item_id === restoreItemId);
        if (fromId >= 0) {
          return fromId;
        }
      }
      if (typeof restoreIndex === "number" && restoreIndex >= 0 && restoreIndex < results.length) {
        return restoreIndex;
      }
      return -1;
    })();

    if (resolvedIndex < 0) {
      onRestoreComplete?.();
      return;
    }

    const restoreKey = `${restoreItemId ?? ""}:${restoreIndex ?? ""}:${results.length}`;
    if (lastRestoreKeyRef.current === restoreKey) {
      return;
    }

    lastRestoreKeyRef.current = restoreKey;
    listRef.current?.scrollToRow({ index: resolvedIndex, align: "center", behavior: "instant" });
    onRestoreComplete?.();
  }, [listRef, onRestoreComplete, restoreIndex, restoreItemId, results]);

  if (!results.length) {
    return <EmptyState title="No current opportunities" description="Try a looser preset or wait for the next scheduled Blizzard data refresh." />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 shadow-md backdrop-blur-xl">
      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 border-b border-white/15 bg-white/5 px-4 py-3 text-[11px] uppercase tracking-label text-zinc-500">
        <div>Item</div>
        <div className="text-center"><SortButton label="Buy" column="cheapest_buy_price" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} /></div>
        <div className="text-center">Sell</div>
        <div className="text-center"><SortButton label="Profit / ROI" column="roi" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} /></div>
        <div className="text-center"><SortButton label="Spread" column="spread_percent" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} /></div>
        <div className="text-center"><SortButton label="Confidence" column="confidence_score" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} /></div>
        <div className="text-center"><SortButton label="Sellability" column="sellability_score" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} /></div>
      </div>

      <List
        style={{ height }}
        rowCount={results.length}
        rowHeight={172}
        rowComponent={Row}
        rowProps={{ results, onOpenProvenance, search, focusedModeActive }}
        listRef={listRef}
        overscanCount={6}
      />
    </div>
  );
}
