import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPreset, deletePreset, getPresets, updatePreset } from "../api/presets";
import { DEFAULT_CATEGORY_OPTIONS } from "../components/filters/FilterSidebar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Select } from "../components/common/Select";
import { Checkbox } from "../components/common/Checkbox";
import { Link } from "../components/common/Link";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import type { ScanPreset } from "../types/models";

const baseForm = {
  name: "",
  min_profit: "",
  min_roi: "",
  max_buy_price: "",
  min_confidence: "",
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
  if (!preset.hide_risky) params.set("hideRisky", "false");
  return `/scanner?${params.toString()}`;
}

const PRESET_CATEGORY_OPTIONS = ["", ...DEFAULT_CATEGORY_OPTIONS];

export function Presets() {
  const queryClient = useQueryClient();
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(baseForm);
  const [message, setMessage] = useState<string | null>(null);
  const presets = presetsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: createPreset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      setForm(baseForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ScanPreset> }) => updatePreset(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      setEditingId(null);
      setForm(baseForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePreset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (presetsQuery.isLoading) {
    return <LoadingState label="Loading scan presets..." />;
  }

  if (presetsQuery.error) {
    return <ErrorState message="Scan presets could not be loaded." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card title={editingId ? "Edit preset" : "Create preset"} subtitle="Build filter bundles for quick scanner views.">
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
              allow_stale: false,
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
          <Input
            id="preset-name"
            label="Preset name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            isCompact
          />
          <Input
            id="preset-min-profit"
            label="Min profit"
            type="number"
            value={form.min_profit}
            onChange={(event) => setForm((current) => ({ ...current, min_profit: event.target.value }))}
            isCompact
          />
          <Input
            id="preset-min-roi"
            label="Min ROI %"
            type="number"
            value={form.min_roi}
            onChange={(event) => setForm((current) => ({ ...current, min_roi: event.target.value }))}
            isCompact
          />
          <Input
            id="preset-max-buy"
            label="Max buy price"
            type="number"
            value={form.max_buy_price}
            onChange={(event) => setForm((current) => ({ ...current, max_buy_price: event.target.value }))}
            isCompact
          />
          <Input
            id="preset-min-confidence"
            label="Min confidence"
            type="number"
            value={form.min_confidence}
            onChange={(event) => setForm((current) => ({ ...current, min_confidence: event.target.value }))}
            isCompact
          />
          <Select
            id="preset-category"
            label="Category filter"
            value={form.category_filter}
            onChange={(event) => setForm((current) => ({ ...current, category_filter: event.target.value }))}
            isCompact
          >
            {PRESET_CATEGORY_OPTIONS.map((category) => (
              <option key={category || "all"} value={category}>
                {category || "All categories"}
              </option>
            ))}
          </Select>
          <Checkbox
            id="preset-hide-risky"
            label="Hide risky flips"
            checked={form.hide_risky}
            onChange={(event) => setForm((current) => ({ ...current, hide_risky: event.target.checked }))}
            compact
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" size="md">
              {editingId ? "Save preset" : "Create preset"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(baseForm);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
          {message && (
            <p className="text-xs text-rose-600 mt-2">{message}</p>
          )}
        </form>
      </Card>

      <Card title="Saved presets" subtitle="Tap to apply or edit.">
        <div className="space-y-2">
          {presets.map((preset) => (
            <div key={preset.id} className="rounded-lg bg-slate-50 px-3 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-ink">{preset.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[
                      preset.min_profit !== null && `Profit ${preset.min_profit}`,
                      preset.min_roi !== null && `ROI ${preset.min_roi}%`,
                      preset.min_confidence !== null && `Conf ${preset.min_confidence}`,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <Link 
                    to={presetToScannerLink(preset)} 
                    variant="default"
                  >
                    <Button size="sm" variant="secondary">
                      Open
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(preset.id);
                      setForm({
                        name: preset.name,
                        min_profit: preset.min_profit?.toString() ?? "",
                        min_roi: preset.min_roi?.toString() ?? "",
                        max_buy_price: preset.max_buy_price?.toString() ?? "",
                        min_confidence: preset.min_confidence?.toString() ?? "",
                        hide_risky: preset.hide_risky,
                        category_filter: preset.category_filter ?? "",
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(preset.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
