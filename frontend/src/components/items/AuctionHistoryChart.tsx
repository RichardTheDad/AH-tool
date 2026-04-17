import { useEffect, useState } from "react";
import type { ItemRealmHistory } from "../../types/models";
import { formatDateTime, formatGold, formatGoldChartLabel } from "../../utils/format";
import { GoldAmount } from "../common/GoldAmount";

interface AuctionHistoryChartProps {
  history: ItemRealmHistory[];
}

function buildLine(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildPriceDomain(values: number[]) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const rawRange = maxValue - minValue;
  const padding = rawRange > 0 ? rawRange * 0.16 : Math.max(maxValue * 0.04, 10000);
  return {
    minValue: Math.max(0, minValue - padding),
    maxValue: maxValue + padding,
  };
}

function formatDepthLabel(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }
  return Math.round(value).toString();
}

export function AuctionHistoryChart({ history }: AuctionHistoryChartProps) {
  const sortedHistory = [...history].sort((left, right) => left.realm.localeCompare(right.realm));
  const [selectedRealm, setSelectedRealm] = useState(sortedHistory[0]?.realm ?? "");

  useEffect(() => {
    if (!sortedHistory.some((entry) => entry.realm === selectedRealm)) {
      setSelectedRealm(sortedHistory[0]?.realm ?? "");
    }
  }, [selectedRealm, sortedHistory]);

  if (!sortedHistory.length) {
    return <p className="text-sm text-zinc-400">Not enough local snapshot history yet. Run more scans over time to build auction history.</p>;
  }

  const activeHistory = sortedHistory.find((entry) => entry.realm === selectedRealm) ?? sortedHistory[0];
  const chartPoints = activeHistory.points.filter((point) => point.lowest_price !== null || point.average_price !== null);
  if (!chartPoints.length) {
    return <p className="text-sm text-zinc-400">No chartable price points were found for this realm yet.</p>;
  }

  const width = 860;
  const height = 330;
  const paddingLeft = 98;
  const paddingRight = 74;
  const paddingTop = 36;
  const paddingBottom = 58;
  const values = chartPoints.flatMap((point) => [point.lowest_price ?? null, point.average_price ?? null]).filter((value): value is number => value !== null);
  const depthValues = chartPoints.flatMap((point) => [point.quantity ?? 0, point.listing_count ?? 0]);
  const { minValue, maxValue } = buildPriceDomain(values);
  const range = Math.max(maxValue - minValue, 1);
  const maxDepth = Math.max(...depthValues, 1);
  const stepX = chartPoints.length > 1 ? (width - paddingLeft - paddingRight) / (chartPoints.length - 1) : 0;
  const plotTop = paddingTop;
  const plotBottom = height - paddingBottom;
  const plotHeight = plotBottom - plotTop;
  const depthMaxHeight = Math.min(76, plotHeight * 0.34);

  const toXY = (value: number | null, index: number) => {
    if (value === null) {
      return null;
    }
    const x = paddingLeft + stepX * index;
    const normalized = (value - minValue) / range;
    const y = plotBottom - normalized * plotHeight;
    return { x, y };
  };

  const lowestLinePoints = chartPoints.map((point, index) => toXY(point.lowest_price, index)).filter((point): point is { x: number; y: number } => point !== null);
  const averageLinePoints = chartPoints.map((point, index) => toXY(point.average_price, index)).filter((point): point is { x: number; y: number } => point !== null);
  const latestPoint = chartPoints[chartPoints.length - 1];
  const firstPoint = chartPoints[0];
  const barWidth = Math.max(Math.min(stepX * 0.45, 18), chartPoints.length > 1 ? 10 : 18);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sortedHistory.map((entry) => (
          <button
            key={entry.realm}
            type="button"
            onClick={() => setSelectedRealm(entry.realm)}
            className={
              entry.realm === activeHistory.realm
                ? "rounded-full border border-orange-500 bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white transition"
                : "rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition"
            }
          >
            {entry.realm}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-zinc-500">Snapshots</p>
          <p className="mt-1 font-semibold text-zinc-100">{activeHistory.points.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-zinc-500">First observed</p>
          <p className="mt-1 font-semibold text-zinc-100"><GoldAmount value={firstPoint.lowest_price} /></p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-zinc-500">Latest observed</p>
          <p className="mt-1 font-semibold text-zinc-100"><GoldAmount value={latestPoint.lowest_price} /></p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-zinc-500">Latest depth</p>
          <p className="mt-1 font-semibold text-zinc-100">
            {latestPoint.quantity ?? "--"} qty / {latestPoint.listing_count ?? "--"} listings
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/85 to-zinc-950/95 p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[330px] min-w-[760px] w-full" role="img" aria-label={`${activeHistory.realm} auction history`}>
          <rect x={paddingLeft} y={plotTop} width={width - paddingLeft - paddingRight} height={plotHeight} rx={10} fill="rgba(24, 24, 27, 0.38)" />
          <line x1={paddingLeft} x2={width - paddingRight} y1={plotBottom} y2={plotBottom} stroke="#52525b" />
          <line x1={paddingLeft} x2={paddingLeft} y1={plotTop} y2={plotBottom} stroke="#52525b" />
          <line x1={width - paddingRight} x2={width - paddingRight} y1={plotTop} y2={plotBottom} stroke="#3f3f46" strokeDasharray="4 6" />
          <text x={paddingLeft} y={18} fontSize="11" fontWeight="700" fill="#d4d4d8">
            Price history
          </text>
          <text x={width - paddingRight} y={18} textAnchor="end" fontSize="11" fontWeight="700" fill="#a1a1aa">
            Depth
          </text>
          {[0, 1, 2, 3, 4].map((row) => {
            const y = plotTop + (plotHeight / 4) * row;
            return <line key={row} x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#3f3f46" strokeDasharray="4 7" opacity={row === 4 ? 0.55 : 0.9} />;
          })}
          {chartPoints.map((point, index) => {
            const x = paddingLeft + stepX * index - barWidth / 2;
            const quantityHeight = ((point.quantity ?? 0) / maxDepth) * depthMaxHeight;
            const listingHeight = ((point.listing_count ?? 0) / maxDepth) * depthMaxHeight;
            return (
              <g key={`depth-${index}`}>
                <rect
                  x={x}
                  y={plotBottom - quantityHeight}
                  width={barWidth}
                  height={quantityHeight}
                  rx={3}
                  fill="rgba(125, 211, 252, 0.26)"
                >
                  <title>{`${formatDateTime(point.captured_at)} | Quantity ${point.quantity ?? 0}`}</title>
                </rect>
                <rect
                  x={x + barWidth * 0.22}
                  y={plotBottom - listingHeight}
                  width={barWidth * 0.56}
                  height={listingHeight}
                  rx={3}
                  fill="rgba(161, 161, 170, 0.3)"
                >
                  <title>{`${formatDateTime(point.captured_at)} | Listings ${point.listing_count ?? 0}`}</title>
                </rect>
              </g>
            );
          })}
          {[maxValue, minValue + range * 0.75, minValue + range * 0.5, minValue + range * 0.25, minValue].map((labelValue, index) => {
            const y = plotBottom - ((labelValue - minValue) / range) * plotHeight;
            return (
              <text key={index} x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#d4d4d8">
                {formatGoldChartLabel(labelValue)}
              </text>
            );
          })}
          {[maxDepth, maxDepth / 2, 0].map((labelValue, index) => {
            const y = index === 2 ? plotBottom : plotBottom - (labelValue / maxDepth) * depthMaxHeight;
            return (
              <text key={`depth-label-${index}`} x={width - paddingRight + 8} y={y + 4} fontSize="10" fill="#71717a">
                {formatDepthLabel(labelValue)}
              </text>
            );
          })}
          {lowestLinePoints.length > 1 ? (
            <path d={buildLine(lowestLinePoints)} fill="none" stroke="#14b8a6" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {averageLinePoints.length > 1 ? (
            <path d={buildLine(averageLinePoints)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="7 5" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {lowestLinePoints.map((point, index) => (
            <circle key={`lowest-${index}`} cx={point.x} cy={point.y} r="3.8" fill="#14b8a6" stroke="#042f2e" strokeWidth="1">
              <title>{`${formatDateTime(chartPoints[index]?.captured_at)} | Lowest ${formatGold(chartPoints[index]?.lowest_price)}`}</title>
            </circle>
          ))}
          {averageLinePoints.map((point, index) => (
            <circle key={`avg-${index}`} cx={point.x} cy={point.y} r="3" fill="#f59e0b" stroke="#451a03" strokeWidth="1">
              <title>{`${formatDateTime(chartPoints[index]?.captured_at)} | Average ${formatGold(chartPoints[index]?.average_price)}`}</title>
            </circle>
          ))}
          {lowestLinePoints.length ? (
            <text x={Math.min(width - paddingRight - 6, lowestLinePoints[lowestLinePoints.length - 1].x + 8)} y={lowestLinePoints[lowestLinePoints.length - 1].y - 8} fontSize="11" fontWeight="700" fill="#5eead4">
              Low {formatGoldChartLabel(latestPoint.lowest_price ?? 0)}
            </text>
          ) : null}
          {averageLinePoints.length ? (
            <text x={Math.min(width - paddingRight - 6, averageLinePoints[averageLinePoints.length - 1].x + 8)} y={averageLinePoints[averageLinePoints.length - 1].y + 16} fontSize="11" fontWeight="700" fill="#fbbf24">
              Avg {formatGoldChartLabel(latestPoint.average_price ?? 0)}
            </text>
          ) : null}
          {(() => {
            const chartDates = chartPoints.map((p) => new Date(p.captured_at).toDateString());
            const hasSameDayPoints = new Set(chartDates).size < chartPoints.length;
            const labelInterval = Math.max(1, Math.ceil(chartPoints.length / 7));
            return chartPoints.map((point, index) => {
              if (index !== 0 && index !== chartPoints.length - 1 && index % labelInterval !== 0) return null;
              const d = new Date(point.captured_at);
              const label = hasSameDayPoints
                ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })
                : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <text
                  key={`label-${index}`}
                  x={paddingLeft + stepX * index}
                  y={height - 24}
                  textAnchor={index === 0 ? "start" : index === chartPoints.length - 1 ? "end" : "middle"}
                  fontSize="11"
                  fill="#d4d4d8"
                >
                  {label}
                </text>
              );
            });
          })()}
        </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            Lowest listing
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-amber-400" />
            Average listing
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-sky-300/60" />
            Quantity trend
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-zinc-500/50" />
            Listing-count trend
          </span>
          <span>History reflects local snapshot data collected by this app, not completed sales.</span>
        </div>
      </div>
    </div>
  );
}
