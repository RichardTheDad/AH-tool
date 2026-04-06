import { apiFormRequest } from "./client";
import type { ListingImportResponse } from "../types/models";

export function importListings(file: File, commit = false) {
  const form = new FormData();
  form.append("file", file);
  form.append("commit", String(commit));
  return apiFormRequest<ListingImportResponse>("/imports/listings", form);
}

