import { apiRequest } from "./client";
import type { ItemDetail, ItemSummary, LiveListingLookupResponse } from "../types/models";

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeItemDetail(item: ItemDetail): ItemDetail {
  return {
    ...item,
    latest_listings: asArray(item.latest_listings),
    auction_history: asArray(item.auction_history),
    tsm_realm_stats: asArray(item.tsm_realm_stats),
    tsm_ledger_summary: item.tsm_ledger_summary
      ? {
          ...item.tsm_ledger_summary,
          recent_sales: asArray(item.tsm_ledger_summary.recent_sales),
        }
      : item.tsm_ledger_summary,
  };
}

function normalizeLiveLookup(payload: LiveListingLookupResponse): LiveListingLookupResponse {
  return {
    ...payload,
    listings: asArray(payload.listings),
  };
}

export function searchItems(query: string, limit = 25) {
  return apiRequest<ItemSummary[]>("/items/search", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  }).then((items) => asArray(items));
}

export function getItem(itemId: number) {
  return apiRequest<ItemDetail>(`/items/${itemId}`).then(normalizeItemDetail);
}

export function getLiveItemListings(itemId: number) {
  return apiRequest<LiveListingLookupResponse>(`/items/${itemId}/live-listings`).then(normalizeLiveLookup);
}

export function refreshMetadata(itemIds: number[]) {
  return apiRequest<{ refreshed_count: number; warnings: string[] }>("/items/refresh-metadata", {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

export function refreshMissingMetadata() {
  return apiRequest<{ queued_count: number; warnings: string[] }>("/items/refresh-missing-metadata", {
    method: "POST",
  });
}
