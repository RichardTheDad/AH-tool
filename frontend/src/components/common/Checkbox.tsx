import { type InputHTMLAttributes, forwardRef } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  compact?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      compact = false,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "rounded border border-slate-300 bg-white text-ember focus:ring-2 focus:ring-ember/20 focus:outline-none transition cursor-pointer";
    const sizeClasses = compact ? "h-4 w-4" : "h-5 w-5";
    const labelContainerClass = compact ? "gap-2" : "gap-3";

    return (
      <div className={`flex items-${description ? "start" : "center"} ${labelContainerClass}`}>
        <input
          ref={ref}
          type="checkbox"
          id={id}
          className={`${baseClasses} ${sizeClasses} ${className}`.trim()}
          {...props}
        />
        {label && (
          <label htmlFor={id} className={`${compact ? "text-sm" : "text-base"} font-medium text-slate-700 cursor-pointer`}>
            {label}
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
