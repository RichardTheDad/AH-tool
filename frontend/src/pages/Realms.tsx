import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createRealm, deleteRealm, getRealms, updateRealm } from "../api/realms";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import type { TrackedRealm } from "../types/models";
import { getRealmCatalogEntry, REALM_CATALOG, type RealmCatalogEntry } from "../utils/realmCatalog";

const emptyForm = { realm_name: "", enabled: true };

export function Realms() {
  const queryClient = useQueryClient();
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createRealm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realms"] });
      setForm(emptyForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<TrackedRealm, "id">> }) => updateRealm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realms"] });
      setEditingId(null);
      setForm(emptyForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRealm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realms"] });
    },
  });

  if (realmsQuery.isLoading) {
    return <LoadingState label="Loading tracked realms..." />;
  }

  if (realmsQuery.error) {
    return <ErrorState message="Tracked realms could not be loaded." />;
  }

  const realms = realmsQuery.data ?? [];
  const realmOptions: RealmCatalogEntry[] = [...REALM_CATALOG];

  for (const realm of realms) {
    if (!realmOptions.some((option) => option.realm_name === realm.realm_name)) {
      realmOptions.push({ realm_name: realm.realm_name, region: realm.region });
    }
  }

  realmOptions.sort((left, right) => left.realm_name.localeCompare(right.realm_name));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedRealm = getRealmCatalogEntry(form.realm_name) ?? realmOptions.find((realm) => realm.realm_name === form.realm_name) ?? null;
    if (!selectedRealm) {
      setMessage("Select a realm from the list.");
      return;
    }

    if (
      realms.some(
        (realm) =>
          realm.realm_name.toLowerCase() === form.realm_name.toLowerCase() &&
          realm.id !== editingId,
      )
    ) {
      setMessage("Realm already tracked.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: { ...form, region: selectedRealm.region } });
      return;
    }

    createMutation.mutate({ ...form, region: selectedRealm.region });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card title={editingId ? "Edit realm" : "Add realm"} subtitle="Pick a realm from the built-in list and the region will be inferred automatically.">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-700">
            Realm
            <select
              value={form.realm_name}
              onChange={(event) => setForm((current) => ({ ...current, realm_name: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">Select a realm</option>
              {realmOptions.map((realm) => (
                <option key={realm.realm_name} value={realm.realm_name}>
                  {realm.realm_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Enabled
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
            />
          </label>
          {message ? <p className="text-sm text-rose-700">{message}</p> : null}
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              {editingId ? "Save realm" : "Add realm"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setMessage(null);
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="Tracked realms" subtitle="Enable or disable realms without deleting them from the working set.">
        <div className="space-y-3">
          {realms.map((realm) => (
            <div key={realm.id} className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-ink">{realm.realm_name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateMutation.mutate({ id: realm.id, payload: { enabled: !realm.enabled } })}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                >
                  {realm.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(realm.id);
                    setForm({ realm_name: realm.realm_name, enabled: realm.enabled });
                  }}
                  className="rounded-full border border-brass/40 px-3 py-1.5 text-sm font-semibold text-slate-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(realm.id)}
                  className="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
