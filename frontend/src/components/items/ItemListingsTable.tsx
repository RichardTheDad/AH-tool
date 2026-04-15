import { Badge } from "../common/Badge";
import type { ListingSnapshot, LiveListingRow } from "../../types/models";
import { formatDateTime, formatGold } from "../../utils/format";

type ItemListingRow = Pick<ListingSnapshot, "realm" | "lowest_price" | "average_price" | "quantity" | "listing_count" | "captured_at"> & {
  id?: number;
  is_stale?: boolean;
};

export function ItemListingsTable({ listings }: { listings: Array<ListingSnapshot | LiveListingRow | ItemListingRow> }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 shadow-card backdrop-blur-xl">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-detail text-zinc-500">
          <tr>
            <th className="px-4 py-3">Realm</th>
            <th className="px-4 py-3">Lowest</th>
            <th className="px-4 py-3">Average</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Listings</th>
            <th className="px-4 py-3">Captured</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-zinc-300">
          {listings.map((listing, index) => (
            <tr key={"id" in listing && listing.id !== undefined ? listing.id : `${listing.realm}-${listing.captured_at}-${index}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{listing.realm}</span>
                  {"is_stale" in listing && listing.is_stale ? <Badge tone="warning">Stale</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3">{formatGold(listing.lowest_price)}</td>
              <td className="px-4 py-3">{formatGold(listing.average_price)}</td>
              <td className="px-4 py-3">{listing.quantity ?? "-"}</td>
              <td className="px-4 py-3">{listing.listing_count ?? "-"}</td>
              <td className="px-4 py-3">{formatDateTime(listing.captured_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
