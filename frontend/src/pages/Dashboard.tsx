import { useQuery } from "@tanstack/react-query";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScanReadiness } from "../api/scans";
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
  const readinessQuery = useQuery({ queryKey: ["scans", "readiness"], queryFn: getScanReadiness });

  if (providersQuery.isLoading || realmsQuery.isLoading || scanQuery.isLoading || readinessQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (providersQuery.error || realmsQuery.error || scanQuery.error || readinessQuery.error || !readinessQuery.data) {
    return <ErrorState message="Dashboard data could not be loaded." />;
  }

  const providers = providersQuery.data?.providers ?? [];
  const realms = realmsQuery.data ?? [];
  const latest = scanQuery.data?.latest ?? null;
  const readiness = readinessQuery.data;
  const staleCount = latest?.results.filter((result) => result.has_stale_data).length ?? 0;
  const liveProviders = providers.filter((provider) => provider.supports_live_fetch);
  const liveProviderCount = liveProviders.filter((provider) => provider.available).length;

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
        <Card title="Scanner readiness">
          <p className="text-3xl font-semibold text-ink">{readiness.realms_with_fresh_data}/{readiness.enabled_realm_count}</p>
          <p className={`mt-2 text-sm ${readiness.status === "blocked" ? "text-rose-700" : readiness.status === "caution" ? "text-amber-700" : "text-emerald-700"}`}>
            {readiness.message}
          </p>
        </Card>
        <Card title="Data gaps">
          <p className="text-3xl font-semibold text-ink">{readiness.items_missing_metadata + readiness.missing_realms.length}</p>
          <p className="mt-2 text-sm text-slate-600">
            {readiness.items_missing_metadata} items missing metadata, {readiness.missing_realms.length} enabled realms without listings
          </p>
        </Card>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card">
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.unique_item_count} items in current local cache</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{staleCount} stale results in latest scan</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {liveProviders.length ? `${liveProviderCount}/${liveProviders.length} live-capable providers usable now` : "No live-capable providers configured"}
          </span>
          {readiness.latest_snapshot_at ? <span className="rounded-full bg-slate-100 px-3 py-1">Latest listing {formatDateTime(readiness.latest_snapshot_at)}</span> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {providers.map((provider) => (
          <ProviderStatusCard key={provider.name} provider={provider} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="Latest scan snapshot" subtitle="Top current opportunities across your enabled realm list.">
          {latest ? (
            <ScannerTable
              results={latest.results.slice(0, 5)}
              sortBy="final_score"
              sortDirection="desc"
              onSortChange={() => undefined}
            />
          ) : (
            <EmptyState title="No scan results yet" description="Run the scanner to pull live Blizzard listings into your local cache, or import listing snapshots as a fallback." />
          )}
        </Card>

        <Card title="Realm coverage" subtitle="Freshness and local item coverage across your enabled realm list.">
          <div className="space-y-3">
            {readiness.realms.map((realm) => (
              <div key={realm.realm} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{realm.realm}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {realm.latest_item_count ? `${realm.fresh_item_count} fresh / ${realm.stale_item_count} stale items` : "No local listing data yet"}
                  </p>
                  {realm.freshest_captured_at ? <p className="mt-1 text-xs text-slate-500">Latest listing {formatDateTime(realm.freshest_captured_at)}</p> : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    !realm.has_data
                      ? "bg-rose-100 text-rose-700"
                      : realm.fresh_item_count > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {!realm.has_data ? "Missing data" : realm.fresh_item_count > 0 ? "Fresh" : "Stale only"}
                </span>
              </div>
            ))}
            {!readiness.realms.length && realms.length ? <EmptyState title="No enabled realms" description="Enable at least one tracked realm to build scanner coverage." /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
