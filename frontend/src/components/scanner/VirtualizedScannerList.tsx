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

function Row({ index, style, results }: RowComponentProps<{ results: ScanResult[] }>) {
  const result = results[index];

  return (
    <div style={style} className="border-b border-slate-100 px-4 py-3">
      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] items-start gap-3 text-sm">
        <div className="min-w-0">
          <Link to={`/items/${result.item_id}`} className="font-semibold text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
            {result.item_name}
          </Link>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{result.explanation}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
            {result.is_risky ? <Badge tone="danger">Risky</Badge> : <Badge tone="success">Stable</Badge>}
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

export function VirtualizedScannerList({ results, sortBy, sortDirection, onSortChange }: VirtualizedScannerListProps) {
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
      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
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
        rowProps={{ results }}
        overscanCount={6}
      />
    </div>
  );
}
