import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getLatestSuggestedRealms } from "../api/realmSuggestions";
import { createRealm, getRealms, updateRealm } from "../api/realms";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { formatDateTime, formatGold, formatPercent } from "../utils/format";
import { getSafeUndermineUrl } from "../utils/safeUrl";

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
            <p className="text-sm text-zinc-300">
              Target realms:{" "}
              <span className="font-medium text-zinc-100">
                {selectedTargetRealms.length ? selectedTargetRealms.join(", ") : "none enabled"}
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              Suggested realms refresh automatically after the main scheduled scanner run finishes, and each target set is updated at most once per week.
            </p>
            {enabledRealmNames.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFocusedTargetRealms([])}
                  className={
                    focusedTargetRealms.length === 0
                      ? "rounded-full border border-orange-500 bg-orange-500 px-3 py-1 text-xs font-semibold text-white"
                      : "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300"
                  }
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
                      className={
                        active && focusedTargetRealms.length > 0
                          ? "rounded-full border border-orange-500 bg-orange-500 px-3 py-1 text-xs font-semibold text-white"
                          : "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300"
                      }
                    >
                      {realmName}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {selectedTargetRealms.length ? (
              <p className="mt-2 text-xs text-zinc-500">
                Focused target set: {selectedTargetRealms.join(", ")}
              </p>
            ) : null}
            {report?.generated_at ? <p className="mt-2 text-xs text-zinc-500">Last refreshed {formatDateTime(report.generated_at)}</p> : null}
            {report?.warning_text ? <p className="mt-3 text-sm text-amber-300">{report.warning_text}</p> : null}
          </div>
        </div>
      </Card>

      {!enabledRealms.length ? (
        <EmptyState title="No target realms enabled" description="Enable the realms you want to sell on first, then Suggested realms can look for cheap source realms that fit them." />
      ) : !report ? (
        <EmptyState title="No suggestions yet" description="Suggestions are generated automatically after scheduled scans. Check back after the next weekly refresh window." />
      ) : !report.recommendations.length ? (
        <EmptyState
          title="No source realms surfaced yet"
          description="The latest weekly discovery pass did not find strong source realms for your current targets. Try again after more scans or expand the realms you sell on."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Source realm pool">
              <p className="text-3xl font-semibold text-zinc-100">{report.source_realm_count}</p>
              <p className="mt-2 text-sm text-zinc-300">US source realms considered in the latest rotating discovery batch.</p>
            </Card>
            <Card title="Top recommendation">
              <p className="text-3xl font-semibold text-zinc-100">{report.recommendations[0]?.realm ?? "--"}</p>
              <p className="mt-2 text-sm text-zinc-300">
                {report.recommendations[0]?.opportunity_count ?? 0} viable items, {report.recommendations[0]?.cheapest_source_count ?? 0} cheapest-source wins.
              </p>
            </Card>
            <Card title="Best consistency">
              <p className="text-3xl font-semibold text-zinc-100">{Math.round(report.recommendations[0]?.consistency_score ?? 0)}/100</p>
              <p className="mt-2 text-sm text-zinc-300">Weighted from confidence, sellability, and how often that realm stays cheap across its eligible discovery runs.</p>
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
                  <p className="text-sm text-zinc-300">{realm.explanation}</p>
                  <button
                    type="button"
                    disabled={(knownRealmByName.get(realm.realm.toLowerCase())?.enabled ?? false) || trackRealmMutation.isPending}
                    onClick={() => trackRealmMutation.mutate(realm.realm)}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {(knownRealmByName.get(realm.realm.toLowerCase())?.enabled ?? false)
                      ? "Already tracked"
                      : knownRealmByName.has(realm.realm.toLowerCase())
                        ? "Enable realm"
                        : "Track realm"}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Average profit</p>
                    <p className="mt-1 font-semibold text-emerald-300">{formatGold(realm.average_profit)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Average ROI</p>
                    <p className="mt-1 font-semibold text-zinc-100">{formatPercent(realm.average_roi)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Average confidence</p>
                    <p className="mt-1 font-semibold text-zinc-100">{Math.round(realm.average_confidence)}/100</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Average sellability</p>
                    <p className="mt-1 font-semibold text-zinc-100">{Math.round(realm.average_sellability)}/100</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Appeared recently</p>
                    <p className="mt-1 font-semibold text-zinc-100">{realm.appearance_count}/{realm.window_size || 1} eligible runs</p>
                    <p className="mt-1 text-xs text-zinc-500">Across {realm.recent_run_count || 1} recent discovery runs.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Cheapest recently</p>
                    <p className="mt-1 font-semibold text-zinc-100">{realm.cheap_run_count}/{realm.window_size || 1} eligible runs</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {realm.last_seen_cheapest_at
                        ? `Last seen cheap ${formatDateTime(realm.last_seen_cheapest_at)}`
                        : "No cheapest-source win recorded yet."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Freshness</p>
                    <p className="mt-1 font-semibold text-zinc-100">{formatDateTime(realm.latest_captured_at ?? report.generated_at ?? null)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-label text-zinc-500">Median source buy</p>
                    <p className="mt-1 font-semibold text-zinc-100">{realm.median_buy_price != null ? formatGold(realm.median_buy_price) : "--"}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {realm.best_target_realm ? `Usually routes best into ${realm.best_target_realm}.` : "No clear target realm winner yet."}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-label text-zinc-500">Supporting items</p>
                  <div className="mt-2 space-y-2">
                    {realm.top_items.map((item) => (
                      <div key={`${realm.realm}-${item.item_id}`} className="rounded-2xl border border-white/10 bg-zinc-900/65 px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Link to={`/app/items/${item.item_id}`} className="font-semibold text-zinc-100 hover:underline">
                              {item.item_name}
                            </Link>
                            {getSafeUndermineUrl(item.undermine_url) ? (
                              <a
                                href={getSafeUndermineUrl(item.undermine_url)!}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold uppercase tracking-link text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline"
                              >
                                Undermine
                              </a>
                            ) : null}
                          </div>
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200">{item.turnover_label}</span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-300">
                          Buy on {realm.realm} for {formatGold(item.buy_price)}, target {item.target_realm} at {formatGold(item.target_sell_price)}.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
                          <span className="rounded-full border border-emerald-400/35 bg-emerald-500/20 px-3 py-1 text-emerald-300">{formatGold(item.estimated_profit)} profit</span>
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{formatPercent(item.roi)} ROI</span>
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{Math.round(item.confidence_score)}/100 confidence</span>
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{Math.round(item.sellability_score)}/100 sellability</span>
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
