import { forwardRef, type PropsWithChildren } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  horizontal?: boolean;
}

export const FormField = forwardRef<HTMLDivElement, PropsWithChildren<FormFieldProps>>(
  ({ label, error, hint, required = false, horizontal = false, children }, ref) => {
    if (horizontal) {
      return (
        <div ref={ref} className="grid grid-cols-3 gap-4 items-start">
          <label className="text-sm font-medium text-slate-700 pt-2">
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>
          <div className="col-span-2 space-y-1">
            {children}
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-1">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {children}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

FormField.displayName = "FormField";
