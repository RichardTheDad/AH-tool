import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { clearDefaultPreset, createPreset, deletePreset, getDefaultPreset, getPresets, setDefaultPreset, updatePreset } from "../api/presets";
import { getRealms } from "../api/realms";
import { DEFAULT_CATEGORY_OPTIONS } from "../components/filters/FilterSidebar";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Select } from "../components/common/Select";
import { MultiSelect } from "../components/common/MultiSelect";
import { Checkbox } from "../components/common/Checkbox";
import { Link } from "../components/common/Link";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { useAuth } from "../contexts/AuthContext";
import { useGuestPresets } from "../hooks/useGuestPresets";
import { useGuestRealms } from "../hooks/useGuestRealms";
import type { ScanPreset } from "../types/models";

const baseForm = {
  name: "",
  min_profit: "",
  min_roi: "",
  max_buy_price: "",
  min_confidence: "",
  hide_risky: true,
  category_filter: "",
  buy_realms: [] as string[],
  sell_realms: [] as string[],
};

function presetToScannerLink(preset: ScanPreset) {
  const params = new URLSearchParams();
  if (preset.min_profit != null) params.set("minProfit", String(preset.min_profit));
  if (preset.min_roi != null) params.set("minRoi", String(preset.min_roi));
  if (preset.max_buy_price != null) params.set("maxBuyPrice", String(preset.max_buy_price));
  if (preset.min_confidence != null) params.set("minConfidence", String(preset.min_confidence));
  if (preset.category_filter) params.set("category", preset.category_filter);
  if (preset.buy_realms && preset.buy_realms.length === 1) params.set("buyRealm", preset.buy_realms[0]);
  if (preset.sell_realms && preset.sell_realms.length === 1) params.set("sellRealm", preset.sell_realms[0]);
  if (!preset.hide_risky) params.set("hideRisky", "false");
  const query = params.toString();
  return query ? `/app?${query}` : "/app";
}

const PRESET_CATEGORY_OPTIONS = ["", ...DEFAULT_CATEGORY_OPTIONS];

export function Presets() {
  const location = useLocation();
  const { user } = useAuth();
  const isGuest = !user;
  const queryClient = useQueryClient();
  const guestPresets = useGuestPresets();
  const guestRealms = useGuestRealms();
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: getPresets, enabled: !isGuest });
  const defaultPresetQuery = useQuery({ queryKey: ["presets", "default"], queryFn: getDefaultPreset, enabled: !isGuest });
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms, staleTime: 5 * 60 * 1000, enabled: !isGuest });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(baseForm);
  const [message, setMessage] = useState<string | null>(null);
  const [quickSaveName, setQuickSaveName] = useState("My scanner view");
  const presets = isGuest ? guestPresets.presets : presetsQuery.data ?? [];
  const defaultPreset = isGuest ? guestPresets.defaultPreset : defaultPresetQuery.data;
  const enabledRealms = (isGuest ? guestRealms.realms : realmsQuery.data ?? []).filter((realm) => realm.enabled);

  const scannerStatePayload = (() => {
    const params = new URLSearchParams(location.search);
    const hasScannerState = [
      "minProfit",
      "minRoi",
      "maxBuyPrice",
      "minConfidence",
      "category",
      "buyRealm",
      "sellRealm",
    ].some((key) => params.has(key));
    if (!hasScannerState) {
      return null;
    }
    const buyRealm = params.get("buyRealm");
    const sellRealm = params.get("sellRealm");
    return {
      name: quickSaveName.trim() || "My scanner view",
      min_profit: params.get("minProfit") ? Number(params.get("minProfit")) : null,
      min_roi: params.get("minRoi") ? Number(params.get("minRoi")) : null,
      max_buy_price: params.get("maxBuyPrice") ? Number(params.get("maxBuyPrice")) : null,
      min_confidence: params.get("minConfidence") ? Number(params.get("minConfidence")) : null,
      allow_stale: false,
      hide_risky: params.get("hideRisky") !== "false",
      category_filter: params.get("category") || null,
      buy_realms: buyRealm ? [buyRealm] : null,
      sell_realms: sellRealm ? [sellRealm] : null,
    };
  })();

  const createMutation = useMutation({
    mutationFn: (payload: Omit<ScanPreset, "id" | "is_default"> & { is_default?: boolean }) => (isGuest ? guestPresets.createPreset(payload) : createPreset(payload)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["presets"] });
        queryClient.invalidateQueries({ queryKey: ["presets", "default"] });
      }
      setForm(baseForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ScanPreset> }) => (isGuest ? guestPresets.updatePreset(id, payload) : updatePreset(id, payload)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["presets"] });
        queryClient.invalidateQueries({ queryKey: ["presets", "default"] });
      }
      setEditingId(null);
      setForm(baseForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => (isGuest ? guestPresets.deletePreset(id) : deletePreset(id)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["presets"] });
        queryClient.invalidateQueries({ queryKey: ["presets", "default"] });
      }
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => (isGuest ? guestPresets.setDefaultPreset(id) : setDefaultPreset(id)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["presets"] });
        queryClient.invalidateQueries({ queryKey: ["presets", "default"] });
      }
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const clearDefaultMutation = useMutation({
    mutationFn: () => (isGuest ? guestPresets.clearDefaultPreset() : clearDefaultPreset()),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["presets"] });
        queryClient.invalidateQueries({ queryKey: ["presets", "default"] });
      }
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (!isGuest && presetsQuery.isLoading) {
    return <LoadingState label="Loading scan presets..." />;
  }

  if (!isGuest && presetsQuery.error) {
    return <ErrorState message="Scan presets could not be loaded." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card title={editingId ? "Edit preset" : "Create preset"} subtitle="Build filter bundles for quick scanner views.">
        {isGuest ? (
          <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            Browsing as a guest. Presets are stored in this browser only until you clear site data.
          </div>
        ) : null}
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
              buy_realms: form.buy_realms.length ? form.buy_realms : null,
              sell_realms: form.sell_realms.length ? form.sell_realms : null,
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
          <MultiSelect
            id="preset-buy-realms"
            label="Buy realms"
            values={form.buy_realms}
            onChange={(nextValues) => setForm((current) => ({ ...current, buy_realms: nextValues }))}
            options={(realmsQuery.data ?? [])
              .filter((realm) => realm.enabled)
              .map((realm) => ({ value: realm.realm_name, label: realm.realm_name }))}
            placeholder="Select buy realms"
            isCompact
          />
          <MultiSelect
            id="preset-sell-realms"
            label="Sell realms"
            values={form.sell_realms}
            onChange={(nextValues) => setForm((current) => ({ ...current, sell_realms: nextValues }))}
            options={(realmsQuery.data ?? [])
              .filter((realm) => realm.enabled)
              .map((realm) => ({ value: realm.realm_name, label: realm.realm_name }))}
            placeholder="Select sell realms"
            isCompact
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
            <p className="text-xs text-rose-300 mt-2">{message}</p>
          )}
        </form>
      </Card>

      <Card title="Saved presets" subtitle="Tap to apply or edit.">
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">Default preset</p>
          <p className="mt-1 text-xs text-zinc-400">
            {defaultPreset ? `Current default: ${defaultPreset.name}` : "No default selected."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              id="preset-quick-save-name"
              label="Save current scanner URL filters as"
              value={quickSaveName}
              onChange={(event) => setQuickSaveName(event.target.value)}
              isCompact
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!scannerStatePayload || createMutation.isPending}
              onClick={() => {
                if (scannerStatePayload) {
                  createMutation.mutate(scannerStatePayload);
                }
              }}
            >
              Save current scanner state
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={clearDefaultMutation.isPending}
              onClick={() => clearDefaultMutation.mutate()}
            >
              Reset default preset
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {presets.map((preset) => (
            <div key={preset.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-zinc-100">{preset.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {[
                      preset.min_profit !== null && `Profit ${preset.min_profit}`,
                      preset.min_roi !== null && `ROI ${preset.min_roi}%`,
                      preset.min_confidence !== null && `Conf ${preset.min_confidence}`,
                      preset.buy_realms?.length ? `Buy scope ${preset.buy_realms.length}` : false,
                      preset.sell_realms?.length ? `Sell scope ${preset.sell_realms.length}` : false,
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
                    disabled={preset.is_default || setDefaultMutation.isPending}
                    onClick={() => setDefaultMutation.mutate(preset.id)}
                  >
                    {preset.is_default ? "Default" : "Set default"}
                  </Button>
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
                        buy_realms: preset.buy_realms ?? [],
                        sell_realms: preset.sell_realms ?? [],
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deleteMutation.isPending || preset.is_default}
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
