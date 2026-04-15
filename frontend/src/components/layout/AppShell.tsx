import type { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";
import { Link } from "../common/Link";

const navItems = [
  { to: "/app", label: "Scanner" },
  { to: "/app/realms", label: "Realms" },
  { to: "/app/suggested-realms", label: "Suggested Realms" },
  { to: "/app/presets", label: "Presets" },
];

export function AppShell({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-3 lg:px-8 2xl:px-10">
          <div className="flex items-center gap-8">
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-ember font-semibold">Azeroth Flip</p>
              <h1 className="font-display text-lg font-bold text-ink mt-0.5">WoW Flipping</h1>
            </div>
            <nav className="hidden lg:flex lg:gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/app"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                      isActive 
                        ? "bg-ink text-white" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <Link
                to="https://ko-fi.com/richardthedad"
                external
                variant="muted"
                className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 no-underline hover:border-amber-200 hover:text-ember lg:inline-flex"
              >
                Support data expansion
              </Link>
              <span className="text-xs text-slate-500 hidden sm:inline">{user.email}</span>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate("/home", { replace: true });
                }}
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
        {/* Mobile nav fallback */}
        <nav className="lg:hidden border-t border-slate-100 px-4 py-2 flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                `px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition ${
                  isActive 
                    ? "bg-ink text-white" 
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1680px] px-4 py-6 lg:px-8 2xl:px-10">{children}</main>
    </div>
  );
}
