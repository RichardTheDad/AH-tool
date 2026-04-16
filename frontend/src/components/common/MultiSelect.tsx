import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "./Badge";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id: string;
  label?: string;
  hint?: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  isCompact?: boolean;
}

export function MultiSelect({
  id,
  label,
  hint,
  options,
  values,
  onChange,
  placeholder = "Select one or more",
  isCompact = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values],
  );

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((entry) => entry !== value));
      return;
    }
    onChange([...values, value]);
  }

  return (
    <div className="space-y-1" ref={containerRef}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-200">
          {label}
        </label>
      ) : null}

      <button
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`w-full rounded-lg border border-white/15 bg-white/5 text-left text-zinc-100 transition focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20 ${
          isCompact ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-zinc-200">{selected.length ? `${selected.length} selected` : placeholder}</span>
          <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <Badge key={option.value} tone="neutral">
              {option.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/95 p-2 text-sm shadow-md">
          {options.length ? (
            options.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-zinc-200 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleValue(option.value)}
                    className="h-4 w-4"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })
          ) : (
            <p className="px-2 py-1.5 text-zinc-500">No options available</p>
          )}
        </div>
      ) : null}

      {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}
