import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/scanner", label: "Scanner" },
  { to: "/realms", label: "Realms" },
  { to: "/suggested-realms", label: "Suggested Realms" },
  { to: "/presets", label: "Presets" },
  { to: "/settings", label: "Settings" },
];

export function AppShell({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/50 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-8 2xl:px-10">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.3em] text-ember">AzerothFlip</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-ink">WoW cross-realm flipping</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive ? "bg-ink text-white" : "bg-white/80 text-slate-700 hover:bg-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {user && (
              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs text-slate-500">{user.email}</span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1680px] px-4 py-6 lg:px-8 2xl:px-10">{children}</main>
    </div>
  );
}
