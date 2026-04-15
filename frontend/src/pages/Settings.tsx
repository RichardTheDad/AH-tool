import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/settings";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Select } from "../components/common/Select";
import { Checkbox } from "../components/common/Checkbox";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";

export function Settings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState({
    flat_buffer: "0",
    refresh_interval_minutes: "30",
    stale_after_minutes: "120",
    scoring_preset: "balanced",
    non_commodity_only: true,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForm({
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
    <Card title="Scanner settings" subtitle="AH cut is fixed at 5%. Tune buffers, re-scan cadence, stale windows, and scoring.">
      <form
        className="grid gap-4 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate({
            flat_buffer: Number(form.flat_buffer),
            refresh_interval_minutes: Number(form.refresh_interval_minutes),
            stale_after_minutes: Number(form.stale_after_minutes),
            scoring_preset: form.scoring_preset as "safe" | "balanced" | "aggressive",
            non_commodity_only: form.non_commodity_only,
          });
        }}
      >
        <Input
          id="ah-cut"
          label="AH cut %"
          type="number"
          value={String(settingsQuery.data?.ah_cut_percent ?? 0.05)}
          disabled
          hint="Auction House cut is locked to 5% across the app."
        />
        <Input
          id="flat-buffer"
          label="Flat buffer"
          type="number"
          value={form.flat_buffer}
          onChange={(event) => setForm((current) => ({ ...current, flat_buffer: event.target.value }))}
        />
        <Input
          id="rescan-interval"
          label="Re-scan interval (min)"
          type="number"
          value={form.refresh_interval_minutes}
          onChange={(event) => setForm((current) => ({ ...current, refresh_interval_minutes: event.target.value }))}
        />
        <Input
          id="stale-after"
          label="Stale after (min)"
          type="number"
          value={form.stale_after_minutes}
          onChange={(event) => setForm((current) => ({ ...current, stale_after_minutes: event.target.value }))}
        />
        <Select
          id="scoring-preset"
          label="Scoring preset"
          value={form.scoring_preset}
          onChange={(event) => setForm((current) => ({ ...current, scoring_preset: event.target.value }))}
        >
          <option value="safe">Safe</option>
          <option value="balanced">Balanced</option>
          <option value="aggressive">Aggressive</option>
        </Select>
        <Checkbox
          id="non-commodity"
          label="Non-commodity only"
          checked={form.non_commodity_only}
          onChange={(event) => setForm((current) => ({ ...current, non_commodity_only: event.target.checked }))}
        />
        <div className="lg:col-span-2">
          <Button type="submit" isLoading={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
