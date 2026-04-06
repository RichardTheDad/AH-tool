import { Badge } from "../common/Badge";
import type { ListingSnapshot } from "../../types/models";
import { formatDateTime, formatGold } from "../../utils/format";

export function ItemListingsTable({ listings }: { listings: ListingSnapshot[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-card">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Realm</th>
            <th className="px-4 py-3">Lowest</th>
            <th className="px-4 py-3">Average</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Listings</th>
            <th className="px-4 py-3">Captured</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{listing.realm}</span>
                  {listing.is_stale ? <Badge tone="warning">Stale</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3">{formatGold(listing.lowest_price)}</td>
              <td className="px-4 py-3">{formatGold(listing.average_price)}</td>
              <td className="px-4 py-3">{listing.quantity ?? "—"}</td>
              <td className="px-4 py-3">{listing.listing_count ?? "—"}</td>
              <td className="px-4 py-3">{formatDateTime(listing.captured_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

