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

function workflowLabel(provider: ProviderStatus) {
  if (provider.supports_live_fetch) {
    return { label: "Live fetch", tone: "success" as const };
  }
  if (provider.provider_type === "listing") {
    return { label: "Bulk scan unavailable", tone: "neutral" as const };
  }
  return { label: "Cached or manual", tone: "neutral" as const };
}

export function ProviderStatusCard({ provider }: { provider: ProviderStatus }) {
  const status = statusCopy[provider.status];
  const workflow = workflowLabel(provider);

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-zinc-100 [overflow-wrap:anywhere]">{provider.name}</h3>
          <p className="mt-1 text-sm text-zinc-300 [overflow-wrap:anywhere]">{provider.message}</p>
        </div>
        <div className="shrink-0">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
        <Badge tone="neutral">{provider.provider_type}</Badge>
        <Badge tone={workflow.tone}>{workflow.label}</Badge>
        {provider.cache_records > 0 ? <Badge tone="neutral">{provider.cache_records} cached</Badge> : null}
        {provider.last_checked_at ? <Badge tone="neutral">Checked {formatDateTime(provider.last_checked_at)}</Badge> : null}
        {provider.last_error ? <Badge tone="danger">{provider.last_error}</Badge> : null}
      </div>
    </Card>
  );
}
