import { Link, useLocation } from "react-router-dom";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import { GoldAmount } from "../common/GoldAmount";
import type { ScanResult, ScannerFilters } from "../../types/models";
import { formatGold, formatPercent, formatScore } from "../../utils/format";

function summarizeBaitRisk(score: number) {
  if (score >= 70) return "high bait risk";
  if (score >= 45) return "watch bait risk";
  return "low bait risk";
}

function summarizeLiquidity(score: number) {
  if (score >= 75) return "healthy depth";
  if (score >= 55) return "usable depth";
  return "thin depth";
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
  const liquidity = provenance.components.liquidity;
  const volatility = provenance.components.volatility;
  const antiBait = provenance.components.anti_bait;
  const gateApplied = Boolean(provenance.evidence?.gate_applied);
  const executionRiskReasons = Array.isArray(provenance.adjustments?.execution_risk_reasons)
    ? provenance.adjustments.execution_risk_reasons.filter((value): value is string => typeof value === "string")
    : [];
  return {
    liquidity,
    volatility,
    antiBait,
    gateApplied,
    executionRiskReasons,
  };
}

function isEvidenceGated(result: ScanResult) {
  const provenance = result.score_provenance as { evidence?: Record<string, boolean> } | null | undefined;
  return Boolean(provenance?.evidence?.gate_applied);
}

interface ScannerTableProps {
  results: ScanResult[];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: (next: { sortBy: ScannerFilters["sortBy"]; sortDirection: ScannerFilters["sortDirection"] }) => void;
  onOpenProvenance?: (result: ScanResult) => void;
}

function ItemIcon({ result }: { result: ScanResult }) {
  if (result.item_icon_url) {
    return (
      <img
        src={result.item_icon_url}
        alt=""
        loading="lazy"
        className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-slate-200 bg-slate-100 object-cover"
      />
    );
  }

  return (
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      --
    </div>
  );
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

export function ScannerTable({ results, sortBy, sortDirection, onSortChange, onOpenProvenance }: ScannerTableProps) {
  const location = useLocation();

  if (!results.length) {
    return <EmptyState title="No current opportunities" description="Try a looser preset or wait for the next scheduled Blizzard data refresh." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1070px] divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 min-w-[11rem]">Item</th>
              <th className="px-3 py-3 whitespace-nowrap">Buy realm</th>
              <SortableHeader
                label="Buy price"
                column="cheapest_buy_price"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap"
              />
              <th className="px-3 py-3 whitespace-nowrap">Sell realm</th>
              <th className="px-3 py-3 whitespace-nowrap">Target sell</th>
              <th className="px-3 py-3 whitespace-nowrap font-bold text-emerald-700">Profit</th>
              <SortableHeader
                label="ROI"
                column="roi"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap font-bold"
              />
              <SortableHeader
                label="Confidence"
                column="confidence_score"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap"
              />
              <SortableHeader
                label="Sellability"
                column="sellability_score"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap"
              />
              <th className="px-3 py-3 min-w-[13rem]">Explanation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {results.map((result, index) => (
              <tr key={result.id} id={`scanner-item-${result.item_id}`} className="hover:bg-slate-50 transition">
                <td className="min-w-[10rem] px-3 py-3 align-top">
                  <div className="flex gap-2.5">
                    <ItemIcon result={result} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          to={`/items/${result.item_id}`}
                          state={{
                            from: "scanner",
                            scannerSearch: location.search,
                            restoreItemId: result.item_id,
                            restoreIndex: index,
                          }}
                          className="text-[14px] font-semibold leading-[1.25] text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                        >
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
                        <div className="flex flex-wrap gap-1.5">
                        {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
                        {result.has_stale_data ? <Badge tone="warning">Stale</Badge> : null}
                        {isEvidenceGated(result) ? <Badge tone="warning">Evidence gate</Badge> : null}
                        <Badge
                          tone={
                            summarizeMoverLikelihood(result) === "likely mover"
                              ? "success"
                              : summarizeMoverLikelihood(result) === "tradable"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {summarizeMoverLikelihood(result)}
                        </Badge>
                        {result.is_risky ? <Badge tone="danger">Risky</Badge> : <Badge tone="success">Stable</Badge>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{result.cheapest_buy_realm}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap"><GoldAmount value={result.cheapest_buy_price} /></td>
                <td className="px-3 py-3 align-top whitespace-nowrap">{result.best_sell_realm}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <div className="space-y-1">
                    <div
                      title={
                        result.observed_sell_price != null && result.observed_sell_price !== result.best_sell_price
                          ? `Observed lowest ${formatGold(result.observed_sell_price)} | Recommended sell target ${formatGold(result.best_sell_price)}`
                          : undefined
                      }
                    >
                      {formatGold(result.best_sell_price)}
                    </div>
                    {result.observed_sell_price != null ? (
                      <div className="text-[11px] text-slate-500">Observed <GoldAmount value={result.observed_sell_price} /></div>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap font-bold text-emerald-700"><GoldAmount value={result.estimated_profit} /></td>
                <td className="px-3 py-3 align-top whitespace-nowrap font-bold text-emerald-700">{formatPercent(result.roi)}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  {(() => {
                    const tone = result.confidence_score >= 70
                        ? "success"
                        : result.confidence_score >= 50
                          ? "warning"
                          : "danger";
                    return (
                  <span
                    title={`Confidence ${formatScore(result.confidence_score)} | Sellability ${formatScore(result.sellability_score)} | Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}
                  >
                    <Badge tone={tone}>
                      {formatScore(result.confidence_score)}
                    </Badge>
                  </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <span title={`Sellability ${formatScore(result.sellability_score)} | Turnover ${result.turnover_label}${isEvidenceGated(result) ? " | evidence gate active" : ""}`}>
                    <Badge tone={result.sellability_score >= 75 ? "success" : result.sellability_score >= 55 ? "warning" : "danger"}>
                      {`${result.turnover_label} ${formatScore(result.sellability_score)}`}
                    </Badge>
                  </span>
                </td>
                <td
                  className="min-w-[13rem] max-w-[16rem] px-3 py-3 align-top text-slate-600 [overflow-wrap:anywhere]"
                  title={`Sellability ${formatScore(result.sellability_score)} | Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}
                >
                  {(() => {
                    const provenance = summarizeProvenance(result);
                    return provenance ? (
                      <div className="mb-2 rounded-2xl bg-slate-100 px-3 py-2 text-[11px] text-slate-600">
                        Signals: L {provenance.liquidity?.toFixed?.(1) ?? "--"}, V {provenance.volatility?.toFixed?.(1) ?? "--"}, Anti-bait {provenance.antiBait?.toFixed?.(1) ?? "--"}
                        {provenance.gateApplied ? " | evidence gate applied" : ""}
                        {provenance.executionRiskReasons.length ? ` | execution risk: ${provenance.executionRiskReasons.slice(0, 2).join(", ")}` : ""}
                        {onOpenProvenance ? (
                          <button
                            type="button"
                            onClick={() => onOpenProvenance(result)}
                            className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            Details
                          </button>
                        ) : null}
                      </div>
                    ) : null;
                  })()}
                  <div className="space-y-2">
                    <p>{result.explanation}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-link text-slate-500">
                      <span>{result.turnover_label} turnover</span>
                      <span>{summarizeLiquidity(result.liquidity_score)}</span>
                      <span>{summarizeBaitRisk(result.bait_risk_score)}</span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                      <div>Recommended sell target: {formatGold(result.best_sell_price)}</div>
                      <div>Observed current listing: {result.observed_sell_price != null ? formatGold(result.observed_sell_price) : "--"}</div>
                      <div>
                        Risk readout: {result.is_risky ? "flagged risky" : "within current safety thresholds"}; liquidity {formatScore(result.liquidity_score)}, bait risk {formatScore(result.bait_risk_score)}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
