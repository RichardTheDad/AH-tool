import { useQuery } from "@tanstack/react-query";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScanReadiness } from "../api/scans";
import { Card } from "../components/common/Card";
import { Link } from "../components/common/Link";
import { StatusIndicator } from "../components/common/StatusIndicator";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { formatDateTime } from "../utils/format";
import { readinessTextColor, realmFreshnessBadge } from "../utils/statusStyles";

export function Dashboard() {
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: getProviderStatus });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });
  const scanQuery = useQuery({ queryKey: ["scans", "latest", "dashboard", 5], queryFn: () => getLatestScan(5) });
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
  const primaryListingProvider = providers.find((provider) => provider.name === "blizzard_auctions");
  const nextStep = !realms.length
    ? "Add tracked realms so the app can build coverage."
    : readiness.realms_with_data < 2
      ? "Run a live Blizzard scan to build enough realm coverage for cross-realm comparisons."
      : latest
          ? "Open Scanner to review the latest ranked opportunities and sort by sellability or confidence."
          : "Run a live scan to populate the first ranked board.";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card title="Today's state" subtitle="Quick read on board readiness.">
          <p className={`text-sm font-semibold ${readinessTextColor(readiness.status)}`}>
            {readiness.message}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-zinc-200 border border-white/15">
              {realms.filter((realm) => realm.enabled).length} enabled
            </div>
            {readiness.realms_with_fresh_data > 0 && (
              <StatusIndicator 
                status="success" 
                size="sm" 
                variant="badge" 
                label={`${readiness.realms_with_fresh_data} fresh`}
              />
            )}
            <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-zinc-200 border border-white/15">
              {readiness.unique_item_count} items
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-zinc-200 border border-white/15">
              {latest?.result_count ?? 0} ranked
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-300">
            <span className="font-medium text-zinc-100 block mb-1">Next step:</span>
            {nextStep}
          </p>
        </Card>
        <Card title="Live readiness">
          <p className="text-3xl font-bold text-zinc-100">{liveProviderCount}/{liveProviders.length || 1}</p>
          <p className="mt-2 text-xs text-zinc-400">of live providers ready</p>
          {primaryListingProvider ? (
            <div className="mt-3">
              {primaryListingProvider.available ? (
                <StatusIndicator status="success" size="sm" variant="pill" label="Blizzard scan ready" />
              ) : (
                <StatusIndicator status="warning" size="sm" variant="pill" label="Blizzard scan needs attention" />
              )}
            </div>
          ) : null}
        </Card>
        <Card title="Data coverage">
          <p className="text-3xl font-bold text-zinc-100">{readiness.missing_realms.length}</p>
          <p className="mt-2 text-xs text-zinc-400">realms with gaps</p>
          {staleCount > 0 && (
            <div className="mt-3">
              <StatusIndicator status="warning" size="sm" variant="pill" label={`${staleCount} stale results`} />
            </div>
          )}
        </Card>
      </div>

      <Card title="Where to work" subtitle="Dashboard stays light; details on Scanner.">
        <p className="text-sm text-zinc-300">
          Use the{" "}
          <Link to="/scanner" variant="default">
            Scanner
          </Link>{" "}
          page for provider detail, live scan progress, and operational controls.
        </p>
      </Card>

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
            <EmptyState title="No scan results yet" description="Scheduled scanner cycles pull live Blizzard listings into your local cache automatically." />
          )}
        </Card>

        <Card title="Realm coverage" subtitle="Freshness and item coverage.">
          <div className="space-y-2">
            {readiness.realms.map((realm) => (
              <div key={realm.realm} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-zinc-100">{realm.realm}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {realm.latest_item_count ? `${realm.fresh_item_count} fresh / ${realm.stale_item_count} stale` : "No data yet"}
                  </p>
                </div>
                {realm.has_data ? (
                  realm.fresh_item_count > 0 ? (
                    <StatusIndicator status="success" size="sm" variant="badge" label="Fresh" />
                  ) : (
                    <StatusIndicator status="warning" size="sm" variant="badge" label="Stale" />
                  )
                ) : (
                  <StatusIndicator status="muted" size="sm" variant="badge" label="Missing" />
                )}
              </div>
            ))}
            {!readiness.realms.length && realms.length ? (
              <EmptyState 
                title="No enabled realms" 
                description="Enable at least one realm to build scanner coverage." 
              />
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
