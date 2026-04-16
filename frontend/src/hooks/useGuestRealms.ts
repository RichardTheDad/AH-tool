import { useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { TrackedRealm } from "../types/models";

const GUEST_REALMS_STORAGE_KEY = "guest.realms.v1";

function nextRealmId(realms: TrackedRealm[]) {
  return realms.reduce((maxId, realm) => Math.max(maxId, realm.id), 0) + 1;
}

export function useGuestRealms() {
  const [realms, setRealms] = useLocalStorage<TrackedRealm[]>(GUEST_REALMS_STORAGE_KEY, []);

  return useMemo(() => ({
    realms,
    createRealm(payload: Omit<TrackedRealm, "id">) {
      const created = { ...payload, id: nextRealmId(realms) };
      setRealms((current) => [...current, created]);
      return created;
    },
    updateRealm(id: number, payload: Partial<Omit<TrackedRealm, "id">>) {
      let updatedRealm: TrackedRealm | null = null;
      setRealms((current) => current.map((realm) => {
        if (realm.id !== id) {
          return realm;
        }
        updatedRealm = { ...realm, ...payload };
        return updatedRealm;
      }));
      if (!updatedRealm) {
        throw new Error("Realm not found.");
      }
      return updatedRealm;
    },
    deleteRealm(id: number) {
      setRealms((current) => current.filter((realm) => realm.id !== id));
    },
  }), [realms, setRealms]);
}