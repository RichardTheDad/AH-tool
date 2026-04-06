import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { createPreset, deletePreset, getPresets, updatePreset } from "../api/presets";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import type { ScanPreset } from "../types/models";

const baseForm = {
  name: "",
  min_profit: "",
  min_roi: "",
  max_buy_price: "",
  min_confidence: "",
  allow_stale: false,
  hide_risky: true,
  category_filter: "",
};

function presetToScannerLink(preset: ScanPreset) {
  const params = new URLSearchParams();
  if (preset.min_profit != null) params.set("minProfit", String(preset.min_profit));
  if (preset.min_roi != null) params.set("minRoi", String(preset.min_roi));
  if (preset.max_buy_price != null) params.set("maxBuyPrice", String(preset.max_buy_price));
  if (preset.min_confidence != null) params.set("minConfidence", String(preset.min_confidence));
  if (preset.category_filter) params.set("category", preset.category_filter);
  if (preset.allow_stale) params.set("allowStale", "true");
  if (!preset.hide_risky) params.set("hideRisky", "false");
  return `/scanner?${params.toString()}`;
}

export function Presets() {
  const queryClient = useQueryClient();
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(baseForm);
  const presets = presetsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: createPreset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      setForm(baseForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ScanPreset> }) => updatePreset(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      setEditingId(null);
      setForm(baseForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePreset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presets"] }),
  });

  if (presetsQuery.isLoading) {
    return <LoadingState label="Loading scan presets..." />;
  }

  if (presetsQuery.error) {
    return <ErrorState message="Scan presets could not be loaded." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card title={editingId ? "Edit preset" : "Create preset"} subtitle="Presets are filter bundles for quickly narrowing the scanner view.">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = {
              name: form.name,
              min_profit: form.min_profit ? Number(form.min_profit) : null,
              min_roi: form.min_roi ? Number(form.min_roi) : null,
              max_buy_price: form.max_buy_price ? Number(form.max_buy_price) : null,
              min_confidence: form.min_confidence ? Number(form.min_confidence) : null,
              allow_stale: form.allow_stale,
              hide_risky: form.hide_risky,
              category_filter: form.category_filter || null,
            };
            if (editingId) {
              updateMutation.mutate({ id: editingId, payload });
            } else {
              createMutation.mutate(payload);
            }
          }}
        >
          {Object.entries(baseForm).map(([key]) => {
            if (key === "allow_stale" || key === "hide_risky") {
              return (
                <label key={key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {key.replace(/_/g, " ")}
                  <input
                    type="checkbox"
                    checked={Boolean(form[key as keyof typeof form])}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                </label>
              );
            }

            return (
              <label key={key} className="block text-sm text-slate-700">
                {key.replace(/_/g, " ")}
                <input
                  value={String(form[key as keyof typeof form] ?? "")}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </label>
            );
          })}
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              {editingId ? "Save preset" : "Create preset"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(baseForm);
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="Saved presets" subtitle="Apply one from the scanner or jump straight there from this list.">
        <div className="space-y-3">
          {presets.map((preset) => (
            <div key={preset.id} className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-ink">{preset.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Profit {preset.min_profit ?? "—"} | ROI {preset.min_roi ?? "—"} | Confidence {preset.min_confidence ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={presetToScannerLink(preset)} className="rounded-full border border-brass/40 px-3 py-1.5 text-sm font-semibold text-slate-700">
                    Open in scanner
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(preset.id);
                      setForm({
                        name: preset.name,
                        min_profit: preset.min_profit?.toString() ?? "",
                        min_roi: preset.min_roi?.toString() ?? "",
                        max_buy_price: preset.max_buy_price?.toString() ?? "",
                        min_confidence: preset.min_confidence?.toString() ?? "",
                        allow_stale: preset.allow_stale,
                        hide_risky: preset.hide_risky,
                        category_filter: preset.category_filter ?? "",
                      });
                    }}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(preset.id)}
                    className="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
