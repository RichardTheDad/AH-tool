import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getLatestSuggestedRealms, runSuggestedRealms } from "../api/realmSuggestions";
import { createRealm, getRealms, updateRealm } from "../api/realms";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { formatDateTime, formatGold, formatPercent } from "../utils/format";

export function SuggestedRealms() {
  const queryClient = useQueryClient();
  const [focusedTargetRealms, setFocusedTargetRealms] = useState<string[]>([]);
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });
  const enabledRealms = (realmsQuery.data ?? []).filter((realm) => realm.enabled);
  const enabledRealmNames = useMemo(() => enabledRealms.map((realm) => realm.realm_name).sort(), [realmsQuery.data]);
  const enabledRealmKey = enabledRealmNames.join("|");
  useEffect(() => {
    setFocusedTargetRealms((current) => {
      const next = current.filter((realm) => enabledRealmNames.includes(realm));
      return next.length === current.length && next.every((realm, index) => realm === current[index]) ? current : next;
    });
  }, [enabledRealmKey]);
  const selectedTargetRealms = (focusedTargetRealms.length ? focusedTargetRealms : enabledRealmNames).slice().sort();
  const suggestionsQuery = useQuery({
    queryKey: ["realm-suggestions", "latest", selectedTargetRealms.join("|")],
    queryFn: () => getLatestSuggestedRealms(selectedTargetRealms),
  });
  const trackRealmMutation = useMutation({
    mutationFn: (realmName: string) => {
      const existingRealm = (realmsQuery.data ?? []).find((realm) => realm.realm_name.toLowerCase() === realmName.toLowerCase());
      if (existingRealm) {
        if (existingRealm.enabled) {
          return Promise.resolve(existingRealm);
        }
        return updateRealm(existingRealm.id, { enabled: true });
      }
      return createRealm({ realm_name: realmName, region: "us", enabled: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realms"] });
      queryClient.invalidateQueries({ queryKey: ["realm-suggestions", "latest"] });
    },
  });

  const runMutation = useMutation({
    mutationFn: () => runSuggestedRealms(selectedTargetRealms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realm-suggestions", "latest"] });
    },
  });

  if (realmsQuery.isLoading || suggestionsQuery.isLoading) {
    return <LoadingState label="Loading suggested realms..." />;
  }

  if (realmsQuery.error || suggestionsQuery.error) {
    return <ErrorState message="Suggested realm data could not be loaded." />;
  }

  const report = suggestionsQuery.data?.latest ?? null;
  const knownRealmByName = new Map((realmsQuery.data ?? []).map((realm) => [realm.realm_name.toLowerCase(), realm]));

  function toggleTargetRealm(realmName: string) {
    setFocusedTargetRealms((current) => {
      if (current.includes(realmName)) {
        return current.filter((realm) => realm !== realmName);
      }
      return [...current, realmName].sort();
    });
  }

  return (
    <div className="space-y-6">
      <Card title="Suggested realms" subtitle="Find US source realms that have recently looked cheap for items that still sell well on your enabled targets.">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              Target realms:{" "}
              <span className="font-medium text-ink">
                {selectedTargetRealms.length ? selectedTargetRealms.join(", ") : "none enabled"}
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              This discovery run is separate from Scanner. It checks a rotating slice of Blizzard US source realms, then reuses your current sellability model against the enabled target realms you have selected below.
            </p>
            {enabledRealmNames.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFocusedTargetRealms([])}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    focusedTargetRealms.length === 0 ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  All enabled
                </button>
                {enabledRealmNames.map((realmName) => {
                  const active = selectedTargetRealms.includes(realmName);
                  return (
                    <button
                      key={realmName}
                      type="button"
                      onClick={() => toggleTargetRealm(realmName)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        active && focusedTargetRealms.length > 0
                          ? "border-ink bg-ink text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {realmName}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {selectedTargetRealms.length ? (
              <p className="mt-2 text-xs text-slate-500">
                Focused target set: {selectedTargetRealms.join(", ")}
              </p>
            ) : null}
            {report?.generated_at ? <p className="mt-2 text-xs text-slate-500">Last refreshed {formatDateTime(report.generated_at)}</p> : null}
            {report?.warning_text ? <p className="mt-3 text-sm text-amber-700">{report.warning_text}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => runMutation.mutate()}
            disabled={!enabledRealms.length || runMutation.isPending}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runMutation.isPending ? "Refreshing..." : "Refresh suggestions"}
          </button>
        </div>
      </Card>

      {!enabledRealms.length ? (
        <EmptyState title="No target realms enabled" description="Enable the realms you want to sell on first, then Suggested realms can look for cheap source realms that fit them." />
      ) : !report ? (
        <EmptyState title="No suggestions yet" description="Run a discovery pass to inspect Blizzard US realms and build your first suggested source-realm board." />
      ) : !report.recommendations.length ? (
        <EmptyState
          title="No source realms surfaced yet"
          description="The discovery pass did not find strong source realms for your current targets. Try again after more scans or expand the realms you sell on."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Source realm pool">
              <p className="text-3xl font-semibold text-ink">{report.source_realm_count}</p>
              <p className="mt-2 text-sm text-slate-600">US source realms considered in the latest rotating discovery batch.</p>
            </Card>
            <Card title="Top recommendation">
              <p className="text-3xl font-semibold text-ink">{report.recommendations[0]?.realm ?? "--"}</p>
              <p className="mt-2 text-sm text-slate-600">
                {report.recommendations[0]?.opportunity_count ?? 0} viable items, {report.recommendations[0]?.cheapest_source_count ?? 0} cheapest-source wins.
              </p>
            </Card>
            <Card title="Best consistency">
              <p className="text-3xl font-semibold text-ink">{Math.round(report.recommendations[0]?.consistency_score ?? 0)}/100</p>
              <p className="mt-2 text-sm text-slate-600">Weighted from confidence, sellability, and how often that realm stays cheap across its eligible discovery runs.</p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {report.recommendations.map((realm) => (
              <Card
                key={realm.realm}
                title={realm.realm}
                subtitle={`${realm.opportunity_count} viable items | ${realm.cheapest_source_count} cheapest-source wins | Consistency ${Math.round(realm.consistency_score)}/100`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <p className="text-sm text-slate-600">{realm.explanation}</p>
                  <button
                    type="button"
                    disabled={(knownRealmByName.get(realm.realm.toLowerCase())?.enabled ?? false) || trackRealmMutation.isPending}
                    onClick={() => trackRealmMutation.mutate(realm.realm)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {(knownRealmByName.get(realm.realm.toLowerCase())?.enabled ?? false)
                      ? "Already tracked"
                      : knownRealmByName.has(realm.realm.toLowerCase())
                        ? "Enable realm"
                        : "Track realm"}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Average profit</p>
                    <p className="mt-1 font-semibold text-emerald-700">{formatGold(realm.average_profit)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Average ROI</p>
                    <p className="mt-1 font-semibold text-ink">{formatPercent(realm.average_roi)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Average confidence</p>
                    <p className="mt-1 font-semibold text-ink">{Math.round(realm.average_confidence)}/100</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Average sellability</p>
                    <p className="mt-1 font-semibold text-ink">{Math.round(realm.average_sellability)}/100</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Appeared recently</p>
                    <p className="mt-1 font-semibold text-ink">{realm.appearance_count}/{realm.window_size || 1} eligible runs</p>
                    <p className="mt-1 text-xs text-slate-500">Across {realm.recent_run_count || 1} recent discovery runs.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Cheapest recently</p>
                    <p className="mt-1 font-semibold text-ink">{realm.cheap_run_count}/{realm.window_size || 1} eligible runs</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {realm.last_seen_cheapest_at
                        ? `Last seen cheap ${formatDateTime(realm.last_seen_cheapest_at)}`
                        : "No cheapest-source win recorded yet."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Freshness</p>
                    <p className="mt-1 font-semibold text-ink">{formatDateTime(realm.latest_captured_at ?? report.generated_at ?? null)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Median source buy</p>
                    <p className="mt-1 font-semibold text-ink">{realm.median_buy_price != null ? formatGold(realm.median_buy_price) : "--"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {realm.best_target_realm ? `Usually routes best into ${realm.best_target_realm}.` : "No clear target realm winner yet."}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Supporting items</p>
                  <div className="mt-2 space-y-2">
                    {realm.top_items.map((item) => (
                      <div key={`${realm.realm}-${item.item_id}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <Link to={`/items/${item.item_id}`} className="font-semibold text-ink hover:underline">
                            {item.item_name}
                          </Link>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.turnover_label}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Buy on {realm.realm} for {formatGold(item.buy_price)}, target {item.target_realm} at {formatGold(item.target_sell_price)}.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{formatGold(item.estimated_profit)} profit</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{formatPercent(item.roi)} ROI</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{Math.round(item.confidence_score)}/100 confidence</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{Math.round(item.sellability_score)}/100 sellability</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
