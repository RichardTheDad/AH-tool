import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getItem } from "../api/items";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { ItemListingsTable } from "../components/items/ItemListingsTable";
import { formatGold, formatPercent, formatScore } from "../utils/format";

export function ItemDetail() {
  const params = useParams();
  const itemId = Number(params.itemId);
  const itemQuery = useQuery({
    queryKey: ["items", itemId],
    queryFn: () => getItem(itemId),
    enabled: Number.isFinite(itemId),
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

      <Card title="Latest listings" subtitle="Most recent snapshot per tracked realm.">
        <ItemListingsTable listings={item.latest_listings} />
      </Card>
    </div>
  );
}
