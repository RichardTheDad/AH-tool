import { apiRequest } from "./client";

export function deleteAccount() {
  return apiRequest<void>("/account", { method: "DELETE" });
}
