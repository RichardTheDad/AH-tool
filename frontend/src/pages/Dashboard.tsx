import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getProviderStatus } from "../api/providers";
import { getRealms } from "../api/realms";
import { getLatestScan, getScanReadiness } from "../api/scans";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { ScannerTable } from "../components/scanner/ScannerTable";
import { formatDateTime } from "../utils/format";

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
      : readiness.items_missing_metadata > 0
        ? "Let the automatic metadata sweeper keep filling missing item details while you keep scanning."
        : latest
          ? "Open Scanner to review the latest ranked opportunities and sort by sellability or confidence."
          : "Run a live scan to populate the first ranked board.";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card title="Today's state" subtitle="A quick read on whether the board is ready to trust.">
          <p className={`text-sm font-semibold ${readiness.status === "blocked" ? "text-rose-700" : readiness.status === "caution" ? "text-amber-700" : "text-emerald-700"}`}>
            {readiness.message}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">{realms.filter((realm) => realm.enabled).length} enabled realms</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.realms_with_fresh_data}/{readiness.enabled_realm_count} fresh realms</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{readiness.unique_item_count} items in coverage</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{latest?.result_count ?? 0} ranked results</span>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Next step: <span className="font-medium text-ink">{nextStep}</span>
          </p>
        </Card>
        <Card title="Live readiness">
          <p className="text-3xl font-semibold text-ink">{liveProviderCount}/{liveProviders.length || 1}</p>
          <p className="mt-2 text-sm text-slate-600">{liveProviders.length ? "live-capable providers usable" : "no live providers configured"}</p>
          {primaryListingProvider ? (
            <p className={`mt-3 text-sm ${primaryListingProvider.available ? "text-emerald-700" : "text-amber-700"}`}>
              Blizzard live scan {primaryListingProvider.available ? "is ready" : "needs attention"}
            </p>
          ) : null}
        </Card>
        <Card title="Data gaps">
          <p className="text-3xl font-semibold text-ink">{readiness.items_missing_metadata + readiness.missing_realms.length}</p>
          <p className="mt-2 text-sm text-slate-600">
            {readiness.items_missing_metadata} metadata gaps, {readiness.missing_realms.length} realms without listings
          </p>
          <p className="mt-3 text-sm text-slate-500">{staleCount} stale results in the latest board</p>
          {readiness.latest_snapshot_at ? <p className="mt-2 text-xs text-slate-500">Latest listing {formatDateTime(readiness.latest_snapshot_at)}</p> : null}
        </Card>
      </div>

      <Card title="Where to work" subtitle="Dashboard stays light; operational detail lives on Scanner.">
        <p className="text-sm text-slate-600">
          Use the{" "}
          <Link to="/scanner" className="font-semibold text-ink underline-offset-4 hover:underline">
            Scanner
          </Link>{" "}
          page for provider detail, live scan progress, sellability sorting, recent scan history, and operational controls.
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
