import { useEffect, useState } from "react";
import type { ItemRealmHistory } from "../../types/models";
import { formatDateTime, formatGold } from "../../utils/format";

interface AuctionHistoryChartProps {
  history: ItemRealmHistory[];
}

function buildLine(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
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
    return <p className="text-sm text-slate-500">Not enough local snapshot history yet. Run more scans over time to build auction history.</p>;
  }

  const activeHistory = sortedHistory.find((entry) => entry.realm === selectedRealm) ?? sortedHistory[0];
  const chartPoints = activeHistory.points.filter((point) => point.lowest_price !== null || point.average_price !== null);
  if (!chartPoints.length) {
    return <p className="text-sm text-slate-500">No chartable price points were found for this realm yet.</p>;
  }

  const width = 760;
  const height = 260;
  const paddingLeft = 54;
  const paddingRight = 18;
  const paddingTop = 20;
  const paddingBottom = 40;
  const values = chartPoints.flatMap((point) => [point.lowest_price ?? null, point.average_price ?? null]).filter((value): value is number => value !== null);
  const depthValues = chartPoints.flatMap((point) => [point.quantity ?? 0, point.listing_count ?? 0]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const maxDepth = Math.max(...depthValues, 1);
  const stepX = chartPoints.length > 1 ? (width - paddingLeft - paddingRight) / (chartPoints.length - 1) : 0;

  const toXY = (value: number | null, index: number) => {
    if (value === null) {
      return null;
    }
    const x = paddingLeft + stepX * index;
    const normalized = (value - minValue) / range;
    const y = height - paddingBottom - normalized * (height - paddingTop - paddingBottom);
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
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              entry.realm === activeHistory.realm ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {entry.realm}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-slate-500">Snapshots</p>
          <p className="mt-1 font-semibold text-ink">{activeHistory.points.length}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-slate-500">First observed</p>
          <p className="mt-1 font-semibold text-ink">{formatGold(firstPoint.lowest_price)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-slate-500">Latest observed</p>
          <p className="mt-1 font-semibold text-ink">{formatGold(latestPoint.lowest_price)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-xs uppercase tracking-detail text-slate-500">Latest depth</p>
          <p className="mt-1 font-semibold text-ink">
            {latestPoint.quantity ?? "--"} qty / {latestPoint.listing_count ?? "--"} listings
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full" role="img" aria-label={`${activeHistory.realm} auction history`}>
          {[0, 1, 2, 3].map((row) => {
            const y = paddingTop + ((height - paddingTop - paddingBottom) / 3) * row;
            return <line key={row} x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />;
          })}
          {chartPoints.map((point, index) => {
            const x = paddingLeft + stepX * index - barWidth / 2;
            const quantityHeight = ((point.quantity ?? 0) / maxDepth) * 52;
            const listingHeight = ((point.listing_count ?? 0) / maxDepth) * 52;
            return (
              <g key={`depth-${index}`}>
                <rect
                  x={x}
                  y={height - paddingBottom - quantityHeight}
                  width={barWidth}
                  height={quantityHeight}
                  rx={3}
                  fill="rgba(59, 130, 246, 0.14)"
                >
                  <title>{`${formatDateTime(point.captured_at)} | Quantity ${point.quantity ?? 0}`}</title>
                </rect>
                <rect
                  x={x + barWidth * 0.22}
                  y={height - paddingBottom - listingHeight}
                  width={barWidth * 0.56}
                  height={listingHeight}
                  rx={3}
                  fill="rgba(15, 23, 42, 0.12)"
                >
                  <title>{`${formatDateTime(point.captured_at)} | Listings ${point.listing_count ?? 0}`}</title>
                </rect>
              </g>
            );
          })}
          {[minValue, minValue + range / 2, maxValue].map((labelValue, index) => {
            const y = height - paddingBottom - ((labelValue - minValue) / range) * (height - paddingTop - paddingBottom);
            return (
              <text key={index} x={6} y={y + 4} fontSize="11" fill="#64748b">
                {formatGold(labelValue)}
              </text>
            );
          })}
          {lowestLinePoints.length > 1 ? (
            <path d={buildLine(lowestLinePoints)} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {averageLinePoints.length > 1 ? (
            <path d={buildLine(averageLinePoints)} fill="none" stroke="#b45309" strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {lowestLinePoints.map((point, index) => (
            <circle key={`lowest-${index}`} cx={point.x} cy={point.y} r="3.2" fill="#0f766e">
              <title>{`${formatDateTime(chartPoints[index]?.captured_at)} | Lowest ${formatGold(chartPoints[index]?.lowest_price)}`}</title>
            </circle>
          ))}
          {averageLinePoints.map((point, index) => (
            <circle key={`avg-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#f59e0b">
              <title>{`${formatDateTime(chartPoints[index]?.captured_at)} | Average ${formatGold(chartPoints[index]?.average_price)}`}</title>
            </circle>
          ))}
          {chartPoints.map((point, index) => (
            <text
              key={`label-${index}`}
              x={paddingLeft + stepX * index}
              y={height - 12}
              textAnchor={index === 0 ? "start" : index === chartPoints.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill="#64748b"
            >
              {new Date(point.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          ))}
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-700" />
            Lowest listing
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-amber-600" />
            Average listing
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-sky-300/60" />
            Quantity trend
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-slate-400/50" />
            Listing-count trend
          </span>
          <span>History reflects local snapshot data collected by this app, not completed sales.</span>
        </div>
      </div>
    </div>
  );
}
