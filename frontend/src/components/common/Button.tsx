import { type ButtonHTMLAttributes, forwardRef } from "react";
import { type ButtonVariant, shape, variants } from "../theme/design-system";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      isLoading = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm font-semibold",
      lg: "px-6 py-2.5 text-base font-semibold",
    };

    const v = variants.button[variant];
    const baseClasses = `rounded-full inline-flex items-center justify-center transition ${v.bg} ${v.text} ${v.border} ${v.hover} ${v.active} ${v.disabled}`;
    const sizeClass = sizeClasses[size];
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClass} ${widthClass} ${className}`.trim()}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
