import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: Array<{ value: string | number; label: string }>;
  isCompact?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      isCompact = false,
      className = "",
      disabled,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "w-full rounded-lg border border-white/15 bg-white/5 text-zinc-100 transition focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20";
    const sizeClasses = isCompact ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm";
    const disabledClasses = disabled ? "opacity-60 cursor-not-allowed" : "";
    const errorClasses = error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/10" : "";

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-zinc-200">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          className={`${baseClasses} ${sizeClasses} ${disabledClasses} ${errorClasses} ${className}`.trim()}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        {hint && !error && <p className="text-xs text-zinc-400">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
