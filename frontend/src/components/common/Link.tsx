import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom";
import { forwardRef, type PropsWithChildren } from "react";

interface LinkProps extends Omit<RouterLinkProps, "to"> {
  to: string;
  external?: boolean;
  variant?: "default" | "muted";
}

export const Link = forwardRef<HTMLAnchorElement, PropsWithChildren<LinkProps>>(
  ({ variant = "default", external = false, className = "", ...props }, ref) => {
    const variantClasses = {
      default: "text-ink hover:text-ember underline-offset-2 hover:underline transition",
      muted: "text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline transition",
    };

    if (external) {
      const { to, ...rest } = props;
      return (
        <a
          ref={ref}
          href={to}
          target="_blank"
          rel="noopener noreferrer"
          className={`${variantClasses[variant]} ${className}`.trim()}
          {...rest}
        />
      );
    }

    return (
      <RouterLink ref={ref} className={`${variantClasses[variant]} ${className}`.trim()} {...(props as RouterLinkProps)} />
    );
  }
);

Link.displayName = "Link";
