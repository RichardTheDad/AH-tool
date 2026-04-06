import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import type { ProviderStatus } from "../../types/models";
import { formatDateTime } from "../../utils/format";

const statusCopy = {
  available: { label: "Available", tone: "success" as const },
  cached_only: { label: "Cached only", tone: "warning" as const },
  unavailable: { label: "Unavailable", tone: "neutral" as const },
  error: { label: "Error", tone: "danger" as const },
};

export function ProviderStatusCard({ provider }: { provider: ProviderStatus }) {
  const status = statusCopy[provider.status];

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-ink [overflow-wrap:anywhere]">{provider.name}</h3>
          <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{provider.message}</p>
        </div>
        <div className="shrink-0">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge tone="neutral">{provider.provider_type}</Badge>
        <Badge tone={provider.supports_live_fetch ? "success" : "neutral"}>
          {provider.supports_live_fetch ? "Live fetch" : "Manual or cached"}
        </Badge>
        {provider.cache_records > 0 ? <Badge tone="neutral">{provider.cache_records} cached</Badge> : null}
        {provider.last_checked_at ? <Badge tone="neutral">Checked {formatDateTime(provider.last_checked_at)}</Badge> : null}
        {provider.last_error ? <Badge tone="danger">{provider.last_error}</Badge> : null}
      </div>
    </Card>
  );
}
