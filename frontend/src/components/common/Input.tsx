import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  isCompact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      isCompact = false,
      className = "",
      disabled,
      id,
      type = "text",
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "w-full rounded-lg border border-slate-200 bg-white transition focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/10";
    const sizeClasses = isCompact ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm";
    const disabledClasses = disabled ? "opacity-60 cursor-not-allowed" : "";
    const errorClasses = error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/10" : "";

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          id={id}
          disabled={disabled}
          className={`${baseClasses} ${sizeClasses} ${disabledClasses} ${errorClasses} ${className}`.trim()}
          {...props}
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
