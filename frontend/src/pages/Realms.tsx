import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createRealm, deleteRealm, getRealms, updateRealm } from "../api/realms";
import { getScanStatus } from "../api/scans";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Select } from "../components/common/Select";
import { Checkbox } from "../components/common/Checkbox";
import { StatusIndicator } from "../components/common/StatusIndicator";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingState } from "../components/common/LoadingState";
import { useAuth } from "../contexts/AuthContext";
import { useGuestRealms } from "../hooks/useGuestRealms";
import type { TrackedRealm } from "../types/models";
import { getRealmCatalogEntry, makeRealmCatalogKey, REALM_CATALOG, type RealmCatalogEntry } from "../utils/realmCatalog";

const emptyForm = { realm_key: "", enabled: true };

export function Realms() {
  const { user } = useAuth();
  const isGuest = !user;
  const queryClient = useQueryClient();
  const guestRealms = useGuestRealms();
  const realmsQuery = useQuery({ queryKey: ["realms"], queryFn: getRealms, enabled: !isGuest });
  const scanStatusQuery = useQuery({ queryKey: ["scans", "status"], queryFn: getScanStatus, refetchInterval: 2000 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: Omit<TrackedRealm, "id">) => (isGuest ? guestRealms.createRealm(payload) : createRealm(payload)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["realms"] });
      }
      setForm(emptyForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<TrackedRealm, "id">> }) => (isGuest ? guestRealms.updateRealm(id, payload) : updateRealm(id, payload)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["realms"] });
      }
      setEditingId(null);
      setForm(emptyForm);
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => (isGuest ? guestRealms.deleteRealm(id) : deleteRealm(id)),
    onSuccess: () => {
      if (!isGuest) {
        queryClient.invalidateQueries({ queryKey: ["realms"] });
      }
      setMessage(null);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if ((!isGuest && realmsQuery.isLoading) || scanStatusQuery.isLoading) {
    return <LoadingState label="Loading tracked realms..." />;
  }

  if ((!isGuest && realmsQuery.error) || scanStatusQuery.error || !scanStatusQuery.data) {
    return <ErrorState message="Tracked realms could not be loaded." />;
  }

  const realms = isGuest ? guestRealms.realms : realmsQuery.data ?? [];
  const scanRunning = scanStatusQuery.data.status === "running";
  const realmOptions: RealmCatalogEntry[] = [...REALM_CATALOG];

  for (const realm of realms) {
    if (!realmOptions.some((option) => option.realm_name === realm.realm_name && option.region === realm.region)) {
      const region = realm.region.toLowerCase() === "eu" ? "eu" : "us";
      realmOptions.push({
        key: makeRealmCatalogKey(realm.realm_name, region),
        realm_name: realm.realm_name,
        region,
        region_label: region === "eu" ? "EU" : "NA",
      });
    }
  }

  realmOptions.sort((left, right) => left.region_label.localeCompare(right.region_label) || left.realm_name.localeCompare(right.realm_name));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedRealm = getRealmCatalogEntry(form.realm_key) ?? realmOptions.find((realm) => realm.key === form.realm_key) ?? null;
    if (!selectedRealm) {
      setMessage("Select a realm from the list.");
      return;
    }

    if (
      realms.some(
        (realm) =>
          realm.realm_name.toLowerCase() === selectedRealm.realm_name.toLowerCase() &&
          realm.region.toLowerCase() === selectedRealm.region &&
          realm.id !== editingId,
      )
    ) {
      setMessage("Realm already tracked.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: { realm_name: selectedRealm.realm_name, region: selectedRealm.region, enabled: form.enabled } });
      return;
    }

    createMutation.mutate({ realm_name: selectedRealm.realm_name, region: selectedRealm.region, enabled: form.enabled });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card title={editingId ? "Edit realm" : "Add realm"} subtitle="Select from the built-in list.">
        {isGuest ? (
          <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            Browsing as a guest. Realm selections are stored in this browser only until you clear site data.
          </div>
        ) : null}
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Select
            id="realm-select"
            label="Realm"
            value={form.realm_key}
            onChange={(event) => setForm((current) => ({ ...current, realm_key: event.target.value }))}
          >
            <option value="">Select a realm</option>
            {realmOptions.map((realm) => (
              <option key={realm.key} value={realm.key}>
                {realm.realm_name} [{realm.region_label}]
              </option>
            ))}
          </Select>
          <Checkbox
            id="realm-enabled"
            label="Enable for scanning"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          {message ? <StatusIndicator status="danger" size="sm" variant="inline" label={message} /> : null}
          {scanRunning ? <StatusIndicator status="info" size="sm" variant="inline" label={scanStatusQuery.data?.message || "Scanning..."} /> : null}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={scanRunning} size="md">
              {editingId ? "Save realm" : "Add realm"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                disabled={scanRunning}
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setMessage(null);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="Tracked realms" subtitle="Manage your realm list.">
        <div className="space-y-2">
          {realms.map((realm) => (
            <div key={realm.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-zinc-100">{realm.realm_name}</p>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
                    {realm.region.toLowerCase() === "eu" ? "EU" : "NA"}
                  </span>
                </div>
                {!realm.enabled && <p className="text-xs text-zinc-400 mt-0.5">Disabled</p>}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={scanRunning}
                  onClick={() => updateMutation.mutate({ id: realm.id, payload: { enabled: !realm.enabled } })}
                >
                  {realm.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={scanRunning}
                  onClick={() => {
                    setEditingId(realm.id);
                    setForm({ realm_key: makeRealmCatalogKey(realm.realm_name, realm.region), enabled: realm.enabled });
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={scanRunning || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(realm.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {!realms.length && <p className="text-sm text-zinc-400 text-center py-6">No realms tracked yet. Add one to get started.</p>}
        </div>
      </Card>
    </div>
  );
}
