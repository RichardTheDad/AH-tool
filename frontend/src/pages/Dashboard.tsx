import { useQuery } from "@tanstack/react-query";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan } from "../api/scans";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { ProviderStatusCard } from "../components/providers/ProviderStatusCard";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { formatDateTime } from "../utils/format";

export function Dashboard() {
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });
  const scanQuery = useQuery({ queryKey: ["scans", "latest"], queryFn: getLatestScan });

  if (providersQuery.isLoading || realmsQuery.isLoading || scanQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (providersQuery.error || realmsQuery.error || scanQuery.error) {
    return <ErrorState message="Dashboard data could not be loaded." />;
  }

  const providers = providersQuery.data?.providers ?? [];
  const realms = realmsQuery.data ?? [];
  const latest = scanQuery.data?.latest ?? null;
  const staleCount = latest?.results.filter((result) => result.has_stale_data).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Tracked realms">
          <p className="text-3xl font-semibold text-ink">{realms.length}</p>
          <p className="mt-2 text-sm text-slate-600">{realms.filter((realm) => realm.enabled).length} enabled for scanning</p>
        </Card>
        <Card title="Latest scan">
          <p className="text-3xl font-semibold text-ink">{latest?.result_count ?? 0}</p>
          <p className="mt-2 text-sm text-slate-600">{latest ? formatDateTime(latest.generated_at) : "No scan has been run yet"}</p>
        </Card>
        <Card title="Provider coverage">
          <p className="text-3xl font-semibold text-ink">{providers.filter((provider) => provider.available).length}</p>
          <p className="mt-2 text-sm text-slate-600">Available providers out of {providers.length}</p>
        </Card>
        <Card title="Stale warnings">
          <p className="text-3xl font-semibold text-ink">{staleCount}</p>
          <p className="mt-2 text-sm text-slate-600">Opportunities currently touching stale data</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {providers.map((provider) => (
          <ProviderStatusCard key={provider.name} provider={provider} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="Latest scan snapshot" subtitle="Top current opportunities across your enabled realm list.">
          {latest ? (
            <ScannerTable results={latest.results.slice(0, 5)} />
          ) : (
            <EmptyState title="No scan results yet" description="Import real listing snapshots and run the scanner to populate ranked flip opportunities." />
          )}
        </Card>

        <Card title="Realm coverage" subtitle="Quick check of the realm pool the scanner can use right now.">
          <div className="space-y-3">
            {realms.map((realm) => (
              <div key={realm.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{realm.realm_name}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${realm.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {realm.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
