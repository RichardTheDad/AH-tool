import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getItem, getLiveItemListings, refreshMetadata } from "../api/items";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { ItemListingsTable } from "../components/items/ItemListingsTable";
import { formatGold, formatMarketPerDay, formatMarketPercent, formatPercent, formatScore } from "../utils/format";

export function ItemDetail() {
  const params = useParams();
  const itemId = Number(params.itemId);
  const queryClient = useQueryClient();
  const itemQuery = useQuery({
    queryKey: ["items", itemId],
    queryFn: () => getItem(itemId),
    enabled: Number.isFinite(itemId),
  });
  const liveListingsQuery = useQuery({
    queryKey: ["items", itemId, "live-listings"],
    queryFn: () => getLiveItemListings(itemId),
    enabled: false,
  });
  const refreshMetadataMutation = useMutation({
    mutationFn: () => refreshMetadata([itemId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", itemId] });
    },
  });

  if (itemQuery.isLoading) {
    return <LoadingState label="Loading item detail..." />;
  }

  if (itemQuery.error || !itemQuery.data) {
    return <ErrorState message="Item detail could not be loaded." />;
  }

  const item = itemQuery.data;

  return (
    <div className="space-y-6">
      <Card
        title={item.name}
        subtitle={`${item.class_name ?? "Unknown class"}${item.subclass_name ? ` | ${item.subclass_name}` : ""}`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              item.metadata_status === "live"
                ? "bg-sky-100 text-sky-700"
                : item.metadata_status === "missing"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {item.metadata_status === "live" ? "Live metadata" : item.metadata_status === "missing" ? "Metadata missing" : "Cached metadata"}
          </span>
          <button
            type="button"
            onClick={() => refreshMetadataMutation.mutate()}
            disabled={refreshMetadataMutation.isPending}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshMetadataMutation.isPending ? "Refreshing..." : "Refresh live metadata"}
          </button>
        </div>
        {item.metadata_message ? <p className="mb-4 text-sm text-slate-600">{item.metadata_message}</p> : null}
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Quality</p>
            <p className="mt-1 font-semibold text-ink">{item.quality ?? "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Commodity</p>
            <p className="mt-1 font-semibold text-ink">{item.is_commodity ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Best buy</p>
            <p className="mt-1 font-semibold text-ink">{item.recent_scan?.cheapest_buy_realm ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Best sell</p>
            <p className="mt-1 font-semibold text-ink">{item.recent_scan?.best_sell_realm ?? "-"}</p>
          </div>
        </div>
      </Card>

      {item.recent_scan ? (
        <Card title="Recent scan result" subtitle="The latest ranked opportunity for this item across your enabled realms.">
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Profit</p>
              <p className="mt-1 font-semibold text-emerald-700">{formatGold(item.recent_scan.estimated_profit)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">ROI</p>
              <p className="mt-1 font-semibold text-ink">{formatPercent(item.recent_scan.roi)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Confidence</p>
              <p className="mt-1 font-semibold text-ink">{formatScore(item.recent_scan.confidence_score)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Explanation</p>
              <p className="mt-1 text-sm text-slate-600">{item.recent_scan.explanation}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="TSM market stats" subtitle="Region-wide TSM AuctionDB enrichment. These are market metrics, not actual completed-sale transactions.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              item.tsm_status === "available"
                ? "bg-emerald-100 text-emerald-700"
                : item.tsm_status === "error"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {item.tsm_status === "available" ? "TSM available" : item.tsm_status === "error" ? "TSM error" : "TSM unavailable"}
          </span>
        </div>
        {item.tsm_message ? <p className="mb-4 text-sm text-slate-600">{item.tsm_message}</p> : null}
        {item.tsm_region_stats ? (
          <div className="grid gap-4 lg:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Region market avg</p>
              <p className="mt-1 font-semibold text-ink">{formatGold(item.tsm_region_stats.db_region_market_avg)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Region historical</p>
              <p className="mt-1 font-semibold text-ink">{formatGold(item.tsm_region_stats.db_region_historical)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Region sale avg</p>
              <p className="mt-1 font-semibold text-ink">{formatGold(item.tsm_region_stats.db_region_sale_avg)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Region sale rate</p>
              <p
                className="mt-1 font-semibold text-ink"
                title={
                  item.tsm_region_stats.db_region_sale_rate === null || item.tsm_region_stats.db_region_sale_rate === undefined
                    ? "No TSM sale-rate data available."
                    : `Raw value: ${item.tsm_region_stats.db_region_sale_rate}`
                }
              >
                {formatMarketPercent(item.tsm_region_stats.db_region_sale_rate)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Region sold / day</p>
              <p
                className="mt-1 font-semibold text-ink"
                title={
                  item.tsm_region_stats.db_region_sold_per_day === null || item.tsm_region_stats.db_region_sold_per_day === undefined
                    ? "No TSM sold-per-day data available."
                    : `Raw value: ${item.tsm_region_stats.db_region_sold_per_day}`
                }
              >
                {formatMarketPerDay(item.tsm_region_stats.db_region_sold_per_day)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Add a TSM API key to surface region sale-rate and market-value context for this item.</p>
        )}
      </Card>

      <Card title="Latest local listings" subtitle="Most recent cached snapshot per tracked realm.">
        <ItemListingsTable listings={item.latest_listings} />
      </Card>

      <Card title="Live Blizzard lookup" subtitle="On-demand live item listings across your tracked realms from the Blizzard Auction House API.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => liveListingsQuery.refetch()}
              disabled={liveListingsQuery.isFetching}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {liveListingsQuery.isFetching ? "Checking..." : "Check live Blizzard listings"}
            </button>
            {liveListingsQuery.data ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  liveListingsQuery.data.status === "available"
                    ? "bg-emerald-100 text-emerald-700"
                    : liveListingsQuery.data.status === "error"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {liveListingsQuery.data.status}
              </span>
            ) : null}
          </div>
          {liveListingsQuery.error ? <ErrorState message="Live Blizzard lookup failed." /> : null}
          {liveListingsQuery.data ? <p className="text-sm text-slate-600">{liveListingsQuery.data.message}</p> : null}
          {liveListingsQuery.data?.listings.length ? (
            <ItemListingsTable listings={liveListingsQuery.data.listings} />
          ) : (
            <p className="text-sm text-slate-500">Run a live lookup to compare Blizzard&apos;s current per-item view against your local cached listings.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
