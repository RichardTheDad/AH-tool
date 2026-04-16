import { Link, useLocation } from "react-router-dom";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import { GoldAmount } from "../common/GoldAmount";
import { ScoreDial } from "../common/ScoreDial";
import type { ScanResult, ScannerFilters } from "../../types/models";
import { formatGold, formatPercent, formatScore } from "../../utils/format";
import { getSafeItemIconUrl, getSafeUndermineUrl } from "../../utils/safeUrl";

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
  focusedModeActive?: boolean;
  onOpenProvenance?: (result: ScanResult) => void;
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

function SortableHeader({
  label,
  column,
  sortBy,
  sortDirection,
  onSortChange,
  className,
  align = "left",
}: {
  label: string;
  column: ScannerFilters["sortBy"];
  sortBy: ScannerFilters["sortBy"];
  sortDirection: ScannerFilters["sortDirection"];
  onSortChange: ScannerTableProps["onSortChange"];
  className?: string;
  align?: "left" | "center";
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
        className={`whitespace-nowrap transition hover:text-zinc-100 ${align === "center" ? "mx-auto block text-center" : "text-left"}`}
        aria-pressed={active}
      >
        {label}
        {indicator}
      </button>
    </th>
  );
}

export function ScannerTable({ results, sortBy, sortDirection, onSortChange, focusedModeActive = false, onOpenProvenance }: ScannerTableProps) {
  const location = useLocation();

  if (!results.length) {
    return <EmptyState title="No current opportunities" description="Try a looser preset or wait for the next scheduled Blizzard data refresh." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 shadow-md backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1070px] divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider font-semibold text-zinc-400 border-b border-white/15">
            <tr>
              <th className="px-4 py-3 min-w-[11rem]">Item</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Buy realm</th>
              <SortableHeader
                label="Buy price"
                column="cheapest_buy_price"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center"
                align="center"
              />
              <th className="px-3 py-3 whitespace-nowrap text-center">Sell realm</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Target sell</th>
              <th className="px-3 py-3 whitespace-nowrap text-center font-bold text-emerald-300">Profit</th>
              <SortableHeader
                label="ROI"
                column="roi"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center font-bold"
                align="center"
              />
              <SortableHeader
                label="Spread"
                column="spread_percent"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center"
                align="center"
              />
              <SortableHeader
                label="Confidence"
                column="confidence_score"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center"
                align="center"
              />
              <SortableHeader
                label="Sellability"
                column="sellability_score"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center"
                align="center"
              />
              <th className="px-3 py-3 min-w-[13rem]">Explanation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {results.map((result, index) => (
              <tr key={result.id} id={`scanner-item-${result.item_id}`} className="hover:bg-white/5 transition">
                <td className="min-w-[10rem] px-3 py-3 align-top">
                  <div className="flex items-center gap-3">
                    <ItemIcon result={result} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          to={`/app/items/${result.item_id}`}
                          state={{
                            from: "scanner",
                            scannerSearch: location.search,
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
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center">{result.cheapest_buy_realm}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center"><GoldAmount value={result.cheapest_buy_price} /></td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center">{result.best_sell_realm}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center">
                  <div className="space-y-1 text-center">
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
                      <div className="text-[11px] text-zinc-500">Observed <GoldAmount value={result.observed_sell_price} /></div>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center font-bold text-emerald-300"><GoldAmount value={result.estimated_profit} /></td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center font-bold text-emerald-300">{formatPercent(result.roi)}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center text-zinc-200">
                  <span
                    title={
                      result.observed_spread_percent != null
                        ? `Observed spread ${formatPercent(result.observed_spread_percent)}${result.observed_spread_absolute != null ? ` (${formatGold(result.observed_spread_absolute)})` : ""}`
                        : undefined
                    }
                  >
                    {formatPercent(result.spread_percent)}
                  </span>
                  {result.spread_absolute != null ? <div className="text-[11px] text-zinc-500">{formatGold(result.spread_absolute)}</div> : null}
                  {result.sale_average_spread_percent != null ? (
                    <div className="text-[11px] text-zinc-500">
                      Avg {formatPercent(result.sale_average_spread_percent)}
                      {result.sale_average_spread_absolute != null ? ` (${formatGold(result.sale_average_spread_absolute)})` : ""}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">
                  <div className="flex justify-center">
                    <ScoreDial
                      score={result.confidence_score}
                      title={`Confidence ${formatScore(result.confidence_score)} | Sellability ${formatScore(result.sellability_score)} | Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <ScoreDial
                      score={result.sellability_score}
                      title={`Sellability ${formatScore(result.sellability_score)} | Turnover ${result.turnover_label}${isEvidenceGated(result) ? " | evidence gate active" : ""}`}
                    />
                    <span className="text-[10px] uppercase tracking-link text-zinc-500">{result.turnover_label}</span>
                  </div>
                </td>
                <td
                  className="min-w-[13rem] max-w-[16rem] px-3 py-3 align-top text-zinc-300 [overflow-wrap:anywhere]"
                  title={`Sellability ${formatScore(result.sellability_score)} | Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}
                >
                  {(() => {
                    const provenance = summarizeProvenance(result);
                    return provenance ? (
                      <div className="mb-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400">
                        Signals: L {provenance.liquidity?.toFixed?.(1) ?? "--"}, V {provenance.volatility?.toFixed?.(1) ?? "--"}, Anti-bait {provenance.antiBait?.toFixed?.(1) ?? "--"}
                        {provenance.gateApplied ? " | evidence gate applied" : ""}
                        {provenance.executionRiskReasons.length ? ` | execution risk: ${provenance.executionRiskReasons.slice(0, 2).join(", ")}` : ""}
                        {onOpenProvenance ? (
                          <button
                            type="button"
                            onClick={() => onOpenProvenance(result)}
                            className="ml-2 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200"
                          >
                            Why ranked
                          </button>
                        ) : null}
                      </div>
                    ) : null;
                  })()}
                  <div className="space-y-2">
                    <p>{result.explanation}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-link text-zinc-500">
                      <span>{result.turnover_label} turnover</span>
                      <span>{summarizeLiquidity(result.liquidity_score)}</span>
                      <span>{summarizeBaitRisk(result.bait_risk_score)}</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-zinc-400">
                      <div>Recommended sell target: {formatGold(result.best_sell_price)}</div>
                      <div>Observed current listing: {result.observed_sell_price != null ? formatGold(result.observed_sell_price) : "--"}</div>
                      <div>{focusedModeActive ? "Focused view: you are seeing opportunities only in your selected buy/sell realm scope." : "Discovery view: this row was ranked from all enabled realms to show the widest opportunity set."}</div>
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
