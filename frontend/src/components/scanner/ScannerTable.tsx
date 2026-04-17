import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
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
  allowItemNavigation?: boolean;
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

function MobileMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-label text-zinc-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{children}</div>
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

export function ScannerTable({ results, sortBy, sortDirection, onSortChange, focusedModeActive = false, onOpenProvenance, allowItemNavigation = true }: ScannerTableProps) {
  const location = useLocation();

  if (!results.length) {
    return <EmptyState title="No current opportunities" description="Try a looser preset or wait for the next scheduled Blizzard data refresh." />;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {results.map((result, index) => {
          const provenance = summarizeProvenance(result);
          return (
            <article key={result.id} id={`scanner-item-${result.item_id}`} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-3 shadow-md backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <ItemIcon result={result} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {allowItemNavigation ? (
                      <Link
                        to={`/app/items/${result.item_id}`}
                        state={{
                          from: "scanner",
                          scannerSearch: location.search,
                          restoreItemId: result.item_id,
                          restoreIndex: index,
                        }}
                        className="min-w-0 text-[15px] font-semibold leading-snug text-zinc-100 underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                      >
                        {result.item_name}
                      </Link>
                    ) : (
                      <span className="min-w-0 text-[15px] font-semibold leading-snug text-zinc-100 [overflow-wrap:anywhere]">{result.item_name}</span>
                    )}
                    {getSafeUndermineUrl(result.undermine_url) ? (
                      <a
                        href={getSafeUndermineUrl(result.undermine_url)!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold uppercase tracking-link text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline"
                      >
                        Undermine
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
                    {result.item_subclass_name ? <Badge tone="neutral">{result.item_subclass_name}</Badge> : null}
                    {result.has_stale_data ? <Badge tone="warning">Stale</Badge> : null}
                    {isEvidenceGated(result) ? <Badge tone="warning">Evidence gate</Badge> : null}
                    <Badge tone={summarizeMoverLikelihood(result) === "likely mover" ? "success" : summarizeMoverLikelihood(result) === "tradable" ? "neutral" : "warning"}>
                      {summarizeMoverLikelihood(result)}
                    </Badge>
                    {result.is_risky ? <Badge tone="danger">Risky</Badge> : <Badge tone="success">Stable</Badge>}
                  </div>
                </div>
              </div>

              {provenance ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400">
                  <span>
                    Signals: liquidity {provenance.liquidity?.toFixed?.(1) ?? "--"}, volatility {provenance.volatility?.toFixed?.(1) ?? "--"}, anti-bait {provenance.antiBait?.toFixed?.(1) ?? "--"}
                  </span>
                  {onOpenProvenance ? (
                    <button
                      type="button"
                      onClick={() => onOpenProvenance(result)}
                      className="ml-2 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200"
                    >
                      Explination
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MobileMetric label="Buy">
                  <span className="block">{result.cheapest_buy_realm}</span>
                  <GoldAmount value={result.cheapest_buy_price} className="text-zinc-300" />
                </MobileMetric>
                <MobileMetric label="Sell">
                  <span className="block">{result.best_sell_realm}</span>
                  <GoldAmount value={result.best_sell_price} className="text-zinc-300" />
                  {result.observed_sell_price != null ? <span className="mt-0.5 block text-xs font-normal text-zinc-500">Obs {formatGold(result.observed_sell_price)}</span> : null}
                </MobileMetric>
                <MobileMetric label="Profit / ROI">
                  <span className="text-emerald-300"><GoldAmount value={result.estimated_profit} /></span>
                  <span className="mt-0.5 block text-emerald-300">{formatPercent(result.roi)}</span>
                </MobileMetric>
                <MobileMetric label="Spread">
                  <span>{formatPercent(result.spread_percent)}</span>
                  {result.spread_absolute != null ? <span className="mt-0.5 block text-xs font-normal text-zinc-500">{formatGold(result.spread_absolute)}</span> : null}
                </MobileMetric>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-label text-zinc-500">Confidence</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ScoreDial score={result.confidence_score} title={`Confidence ${formatScore(result.confidence_score)}`} />
                    <span className="text-sm font-semibold text-zinc-100">{formatScore(result.confidence_score)}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-label text-zinc-500">Sellability</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ScoreDial score={result.sellability_score} title={`Sellability ${formatScore(result.sellability_score)}`} />
                    <span className="text-sm font-semibold text-zinc-100">{result.turnover_label}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 shadow-md backdrop-blur-xl md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider font-semibold text-zinc-400 border-b border-white/15">
            <tr>
              <th className="px-4 py-3">Item</th>
              <SortableHeader
                label="Buy"
                column="cheapest_buy_price"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center"
                align="center"
              />
              <th className="px-3 py-3 whitespace-nowrap text-center">Sell</th>
              <SortableHeader
                label="Profit / ROI"
                column="roi"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                className="px-3 py-3 whitespace-nowrap text-center font-bold text-emerald-300"
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
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {results.map((result, index) => (
              <tr key={result.id} id={`scanner-item-${result.item_id}`} className="hover:bg-white/5 transition">
                <td className="min-w-[10rem] max-w-[18rem] px-3 py-3 align-top">
                  <div className="flex items-start gap-3">
                    <ItemIcon result={result} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {allowItemNavigation ? (
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
                        ) : (
                          <span className="text-[14px] font-semibold leading-[1.25] text-zinc-100 [overflow-wrap:anywhere]">{result.item_name}</span>
                        )}
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
                      {(() => {
                        const provenance = summarizeProvenance(result);
                        return provenance ? (
                          <p className="text-[11px] text-zinc-500">
                            L {provenance.liquidity?.toFixed?.(1) ?? "--"} V {provenance.volatility?.toFixed?.(1) ?? "--"} Anti-bait {provenance.antiBait?.toFixed?.(1) ?? "--"}
                            {provenance.gateApplied ? " | gate" : ""}
                            {provenance.executionRiskReasons.length ? ` | risk: ${provenance.executionRiskReasons[0]}` : ""}
                            {onOpenProvenance ? (
                              <button
                                type="button"
                                onClick={() => onOpenProvenance(result)}
                                className="ml-2 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200"
                              >
                                Explination
                              </button>
                            ) : null}
                          </p>
                        ) : null;
                      })()}
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {result.item_class_name ? <Badge tone="neutral">{result.item_class_name}</Badge> : null}
                        {result.item_subclass_name ? <Badge tone="neutral">{result.item_subclass_name}</Badge> : null}
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
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center text-zinc-300">
                  <div className="font-medium">{result.cheapest_buy_realm}</div>
                  <GoldAmount value={result.cheapest_buy_price} />
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center text-zinc-300">
                  <div className="font-medium">{result.best_sell_realm}</div>
                  <div><GoldAmount value={result.best_sell_price} /></div>
                  {result.observed_sell_price != null ? (
                    <div className="text-[11px] text-zinc-500">Obs <GoldAmount value={result.observed_sell_price} /></div>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap text-center">
                  <div className="font-bold text-emerald-300"><GoldAmount value={result.estimated_profit} /></div>
                  <div className="text-sm text-emerald-300">{formatPercent(result.roi)}</div>
                </td>
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
                  {result.spread_absolute != null ? <div className="text-[11px] text-zinc-500"><GoldAmount value={result.spread_absolute} className="text-xs" /></div> : null}
                  {result.sale_average_spread_percent != null ? (
                    <div className="text-[11px] text-zinc-500">
                      Avg {formatPercent(result.sale_average_spread_percent)}
                      {result.sale_average_spread_absolute != null ? ` (${formatGold(result.sale_average_spread_absolute)})` : ""}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <ScoreDial
                      score={result.confidence_score}
                      title={`Confidence ${formatScore(result.confidence_score)} | Sellability ${formatScore(result.sellability_score)} | Liquidity ${formatScore(result.liquidity_score)} | Volatility ${formatScore(result.volatility_score)} | Bait risk ${formatScore(result.bait_risk_score)}`}
                    />
                    <span className="text-[10px] uppercase tracking-link text-transparent select-none" aria-hidden="true">--</span>
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
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
