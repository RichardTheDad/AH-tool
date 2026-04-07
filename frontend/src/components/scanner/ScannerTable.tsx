import { Link } from "react-router-dom";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import type { ScanResult, ScannerFilters } from "../../types/models";
import { formatGold, formatPercent, formatScore } from "../../utils/format";

interface ScannerTableProps {
  results: ScanResult[];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: (next: { sortBy: ScannerFilters["sortBy"]; sortDirection: ScannerFilters["sortDirection"] }) => void;
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortDirection,
  onSortChange,
  className,
}: {
  label: string;
  column: ScannerFilters["sortBy"];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: ScannerTableProps["onSortChange"];
  className?: string;
}) {
  const active = sortBy === column;
  const indicator = !active ? "" : sortDirection === "desc" ? " v" : " ^";

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() =>
          onSortChange({
            sortBy: column,
            sortDirection: active && sortDirection === "desc" ? "asc" : "desc",
          })
        }
        className="whitespace-nowrap text-left transition hover:text-ink"
        aria-pressed={active}
      >
        {label}
        {indicator}
      </button>
    </th>
  );
}

export function ScannerTable({ results, sortBy, sortDirection, onSortChange }: ScannerTableProps) {
  if (!results.length) {
    return <EmptyState title="No current opportunities" description="Try a looser preset, import fresher listings, or refresh from an available listing provider." />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1070px] divide-y divide-slate-200 text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-3 py-3 min-w-[10rem]">Item</th>
              <th className="px-4 py-3 whitespace-nowrap">Buy realm</th>
              <SortableHeader
                label="Buy price"
                column="cheapest_buy_price"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-4 py-3 whitespace-nowrap"
              />
              <th className="px-4 py-3 whitespace-nowrap">Sell realm</th>
              <th className="px-4 py-3 whitespace-nowrap">Sell price</th>
              <th className="px-4 py-3 whitespace-nowrap">Profit</th>
              <SortableHeader
                label="ROI"
                column="roi"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-4 py-3 whitespace-nowrap"
              />
              <SortableHeader
                label="Confidence"
                column="confidence_score"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-4 py-3 whitespace-nowrap"
              />
              <th className="px-3 py-3 min-w-[13rem]">Explanation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((result) => (
              <tr key={result.id} className="hover:bg-parchment/40">
                <td className="min-w-[10rem] px-3 py-3 align-top">
                  <div className="flex flex-col gap-1">
                    <Link to={`/items/${result.item_id}`} className="font-semibold leading-snug text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                      {result.item_name}
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
                      {result.has_stale_data ? <Badge tone="warning">Stale</Badge> : null}
                      {result.is_risky ? <Badge tone="danger">Risky</Badge> : <Badge tone="success">Stable</Badge>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{result.cheapest_buy_realm}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{formatGold(result.cheapest_buy_price)}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{result.best_sell_realm}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{formatGold(result.best_sell_price)}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap font-semibold text-emerald-700">{formatGold(result.estimated_profit)}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{formatPercent(result.roi)}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <span title={`Confidence ${formatScore(result.confidence_score)} | Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}>
                    <Badge tone={result.confidence_score >= 70 ? "success" : result.confidence_score >= 50 ? "warning" : "danger"}>
                      {formatScore(result.confidence_score)}
                    </Badge>
                  </span>
                </td>
                <td
                  className="min-w-[13rem] max-w-[16rem] px-3 py-3 align-top text-slate-600 [overflow-wrap:anywhere]"
                  title={`Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}
                >
                  {result.explanation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
