import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/settings";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";

export function Settings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState({
    ah_cut_percent: "0.05",
    flat_buffer: "0",
    refresh_interval_minutes: "30",
    stale_after_minutes: "120",
    scoring_preset: "balanced",
    non_commodity_only: true,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForm({
      ah_cut_percent: String(settingsQuery.data.ah_cut_percent),
      flat_buffer: String(settingsQuery.data.flat_buffer),
      refresh_interval_minutes: String(settingsQuery.data.refresh_interval_minutes),
      stale_after_minutes: String(settingsQuery.data.stale_after_minutes),
      scoring_preset: settingsQuery.data.scoring_preset,
      non_commodity_only: settingsQuery.data.non_commodity_only,
    });
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (settingsQuery.isLoading) {
    return <LoadingState label="Loading settings..." />;
  }

  if (settingsQuery.error) {
    return <ErrorState message="Settings could not be loaded." />;
  }

  return (
    <Card title="Scanner settings" subtitle="Tune fees, auto re-scan cadence, stale windows, and the scoring posture.">
      <form
        className="grid gap-4 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate({
            ah_cut_percent: Number(form.ah_cut_percent),
            flat_buffer: Number(form.flat_buffer),
            refresh_interval_minutes: Number(form.refresh_interval_minutes),
            stale_after_minutes: Number(form.stale_after_minutes),
            scoring_preset: form.scoring_preset as "safe" | "balanced" | "aggressive",
            non_commodity_only: form.non_commodity_only,
          });
        }}
      >
        <label className="block text-sm text-slate-700">
          AH cut percent
          <input
            value={form.ah_cut_percent}
            onChange={(event) => setForm((current) => ({ ...current, ah_cut_percent: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Flat buffer
          <input
            value={form.flat_buffer}
            onChange={(event) => setForm((current) => ({ ...current, flat_buffer: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Auto re-scan interval (minutes)
          <input
            value={form.refresh_interval_minutes}
            onChange={(event) => setForm((current) => ({ ...current, refresh_interval_minutes: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Stale after (minutes)
          <input
            value={form.stale_after_minutes}
            onChange={(event) => setForm((current) => ({ ...current, stale_after_minutes: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Scoring preset
          <select
            value={form.scoring_preset}
            onChange={(event) => setForm((current) => ({ ...current, scoring_preset: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <option value="safe">safe</option>
            <option value="balanced">balanced</option>
            <option value="aggressive">aggressive</option>
          </select>
        </label>
        <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Non-commodity only
          <input
            type="checkbox"
            checked={form.non_commodity_only}
            onChange={(event) => setForm((current) => ({ ...current, non_commodity_only: event.target.checked }))}
          />
        </label>
        <div className="lg:col-span-2">
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            {updateMutation.isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>
    </Card>
  );
}
