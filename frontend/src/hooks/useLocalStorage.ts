import { useCallback, useState } from "react";

type SetValue<T> = T | ((current: T) => T);

function resolveInitialValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") {
    return initialValue;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => resolveInitialValue(key, initialValue));

  const updateValue = useCallback((nextValue: SetValue<T>) => {
    setValue((current) => {
      const resolved = nextValue instanceof Function ? nextValue(current) : nextValue;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          return current;
        }
      }
      return resolved;
    });
  }, [key]);

  return [value, updateValue] as const;
}