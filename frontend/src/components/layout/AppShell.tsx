import type { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";
import { Link } from "../common/Link";

const navItems = [
  { to: "/app", label: "Scanner", guestAllowed: true },
  { to: "/app/realms", label: "Realms", guestAllowed: true },
  { to: "/app/suggested-realms", label: "Suggested Realms", guestAllowed: false },
  { to: "/app/presets", label: "Presets", guestAllowed: true },
  { to: "/app/account", label: "Account", guestAllowed: false },
];

export function AppShell({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const visibleNavItems = navItems.filter((item) => user || item.guestAllowed);

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-3 lg:px-8 2xl:px-10">
          <div className="flex items-center gap-8">
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-ember font-semibold">Azeroth Flip</p>
              <h1 className="font-display text-lg font-bold text-zinc-100 mt-0.5">Cross-realm scanner</h1>
              {!user ? <p className="mt-0.5 text-xs text-zinc-500">Guest mode saves realms and presets in this browser only.</p> : null}
            </div>
            <nav className="hidden lg:flex lg:gap-1">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/app"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                      isActive
                        ? "bg-orange-500 text-white"
                        : "text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {!user ? (
              <Button variant="secondary" size="sm" onClick={() => navigate("/login")}>
                Sign in to sync
              </Button>
            ) : null}
            {user ? (
              <>
                <Link
                  to="https://ko-fi.com/richardthedad"
                  external
                  variant="muted"
                  className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 no-underline hover:border-orange-400/45 hover:text-orange-300 lg:inline-flex"
                >
                  <img src="/kofi-logo.svg" alt="Ko-fi" className="h-4 w-4" />
                  Support on Ko-fi
                </Link>
                <Button variant="secondary" size="sm" onClick={() => navigate("/app/account")}>
                  Account
                </Button>
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
              </>
            ) : null}
          </div>
        </div>
      <nav className="lg:hidden border-t border-white/10 px-4 py-2 flex gap-1 overflow-x-auto bg-zinc-950/90">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                `px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : "text-zinc-300 hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1680px] px-4 py-6 lg:px-8 2xl:px-10 text-zinc-100">{children}</main>
    </div>
  );
}
