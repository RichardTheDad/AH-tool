import { useEffect, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { Link } from "react-router-dom";
import type { ScanResult, ScannerFilters } from "../../types/models";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import { formatGold, formatPercent, formatScore } from "../../utils/format";

interface VirtualizedScannerListProps {
  results: ScanResult[];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: (next: { sortBy: ScannerFilters["sortBy"]; sortDirection: ScannerFilters["sortDirection"] }) => void;
  onOpenProvenance?: (result: ScanResult) => void;
}

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
      className="text-left transition hover:text-ink"
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
  const provenance = result.score_provenance as { components?: Record<string, number>; evidence?: Record<string, boolean> } | null | undefined;
  if (!provenance?.components) {
    return null;
  }
  return {
    liquidity: provenance.components.liquidity,
    volatility: provenance.components.volatility,
    antiBait: provenance.components.anti_bait,
    personal: provenance.components.personal_turnover,
    gateApplied: Boolean(provenance.evidence?.gate_applied),
  };
}

function isEvidenceGated(result: ScanResult) {
  const provenance = result.score_provenance as { evidence?: Record<string, boolean> } | null | undefined;
  return Boolean(provenance?.evidence?.gate_applied);
}

function Row({ index, style, results, onOpenProvenance }: RowComponentProps<{ results: ScanResult[]; onOpenProvenance?: (result: ScanResult) => void }>) {
  const result = results[index];
  const provenance = summarizeProvenance(result);
  const gated = isEvidenceGated(result);

  return (
    <div style={style} className="border-b border-slate-100 px-4 py-3">
      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] items-start gap-3 text-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={`/items/${result.item_id}`} className="font-semibold text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
              {result.item_name}
            </Link>
            {result.undermine_url ? (
              <a
                href={result.undermine_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold uppercase tracking-link text-slate-500 underline-offset-4 hover:text-ink hover:underline"
              >
                Undermine
              </a>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{result.explanation}</p>
          {provenance ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Signals L {provenance.liquidity?.toFixed?.(1) ?? "--"}, V {provenance.volatility?.toFixed?.(1) ?? "--"}, Anti-bait {provenance.antiBait?.toFixed?.(1) ?? "--"}, Personal {provenance.personal?.toFixed?.(1) ?? "--"}
              {provenance.gateApplied ? " | evidence gate" : ""}
              {onOpenProvenance ? (
                <button
                  type="button"
                  onClick={() => onOpenProvenance(result)}
                  className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                >
                  Details
                </button>
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
            {result.is_risky ? <Badge tone="danger">Risky</Badge> : <Badge tone="success">Stable</Badge>}
            {gated ? <Badge tone="warning">Evidence gate</Badge> : null}
            <Badge tone={summarizeMoverLikelihood(result) === "likely mover" ? "success" : "warning"}>{summarizeMoverLikelihood(result)}</Badge>
          </div>
        </div>

        <div className="min-w-0 text-slate-700">
          <div className="font-medium">{result.cheapest_buy_realm}</div>
          <div>{formatGold(result.cheapest_buy_price)}</div>
        </div>

        <div className="min-w-0 text-slate-700">
          <div className="font-medium">{result.best_sell_realm}</div>
          <div>{formatGold(result.best_sell_price)}</div>
          {result.observed_sell_price != null ? <div className="text-xs text-slate-500">Obs {formatGold(result.observed_sell_price)}</div> : null}
        </div>

        <div className="min-w-0">
          <div className="font-semibold text-emerald-700">{formatGold(result.estimated_profit)}</div>
          <div className="text-slate-700">{formatPercent(result.roi)}</div>
        </div>

        <div className="min-w-0">
          <Badge tone={result.confidence_score >= 70 ? "success" : result.confidence_score >= 50 ? "warning" : "danger"}>
            {formatScore(result.confidence_score)}
          </Badge>
        </div>

        <div className="min-w-0">
          <Badge tone={result.sellability_score >= 75 ? "success" : result.sellability_score >= 55 ? "warning" : "danger"}>
            {`${result.turnover_label} ${formatScore(result.sellability_score)}`}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function VirtualizedScannerList({ results, sortBy, sortDirection, onSortChange, onOpenProvenance }: VirtualizedScannerListProps) {
  const [height, setHeight] = useState(560);

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

  if (!results.length) {
    return <EmptyState title="No current opportunities" description="Try a looser preset, import fresher listings, or refresh from an available listing provider." />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-card">
      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-label text-slate-500">
        <div>Item</div>
        <SortButton label="Buy" column="cheapest_buy_price" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />
        <div>Sell</div>
        <SortButton label="Profit / ROI" column="roi" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />
        <SortButton label="Confidence" column="confidence_score" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />
        <SortButton label="Sellability" column="sellability_score" sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />
      </div>

      <List
        style={{ height }}
        rowCount={results.length}
        rowHeight={124}
        rowComponent={Row}
        rowProps={{ results, onOpenProvenance }}
        overscanCount={6}
      />
    </div>
  );
}
