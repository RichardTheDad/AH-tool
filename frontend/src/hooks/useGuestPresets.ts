import { useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { ScanPreset } from "../types/models";

type GuestPresetPayload = Omit<ScanPreset, "id" | "is_default"> & { is_default?: boolean };
const GUEST_PRESETS_STORAGE_KEY = "guest.presets.v1";

function nextPresetId(presets: ScanPreset[]) {
  return presets.reduce((maxId, preset) => Math.max(maxId, preset.id), 0) + 1;
}

export function useGuestPresets() {
  const [presets, setPresets] = useLocalStorage<ScanPreset[]>(GUEST_PRESETS_STORAGE_KEY, []);

  return useMemo(() => ({
    presets,
    defaultPreset: presets.find((preset) => preset.is_default) ?? null,
    async createPreset(payload: GuestPresetPayload) {
      const created: ScanPreset = {
        ...payload,
        id: nextPresetId(presets),
        is_default: Boolean(payload.is_default),
      };
      setPresets((current) => {
        const next = created.is_default ? current.map((preset) => ({ ...preset, is_default: false })) : current;
        return [...next, created];
      });
      return created;
    },
    async updatePreset(id: number, payload: Partial<GuestPresetPayload>) {
      let updatedPreset: ScanPreset | null = null;
      setPresets((current) => current.map((preset) => {
        if (preset.id !== id) {
          return payload.is_default ? { ...preset, is_default: false } : preset;
        }
        updatedPreset = { ...preset, ...payload, is_default: Boolean(payload.is_default ?? preset.is_default) };
        return updatedPreset;
      }));
      if (!updatedPreset) {
        throw new Error("Preset not found.");
      }
      return updatedPreset;
    },
    async deletePreset(id: number) {
      setPresets((current) => current.filter((preset) => preset.id !== id));
    },
    async setDefaultPreset(id: number) {
      let defaultPreset: ScanPreset | null = null;
      setPresets((current) => current.map((preset) => {
        const next = { ...preset, is_default: preset.id === id };
        if (next.is_default) {
          defaultPreset = next;
        }
        return next;
      }));
      if (!defaultPreset) {
        throw new Error("Preset not found.");
      }
      return defaultPreset;
    },
    async clearDefaultPreset() {
      setPresets((current) => current.map((preset) => ({ ...preset, is_default: false })));
    },
  }), [presets, setPresets]);
}