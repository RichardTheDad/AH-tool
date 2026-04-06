import { apiRequest } from "./client";
import type { ItemDetail, ItemSummary } from "../types/models";

export function searchItems(query: string, limit = 25) {
  return apiRequest<ItemSummary[]>("/items/search", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
}

export function getItem(itemId: number) {
  return apiRequest<ItemDetail>(`/items/${itemId}`);
}

export function refreshMetadata(itemIds: number[]) {
  return apiRequest<{ refreshed_count: number; warnings: string[] }>("/items/refresh-metadata", {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

