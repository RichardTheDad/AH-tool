import { useNavigate } from "react-router-dom";
import { Button } from "../common/Button";
import { useAuth } from "../../contexts/AuthContext";

type PublicHeaderProps = {
  subtitle: string;
  secondaryCtaLabel: string;
  secondaryCtaTo: string;
  tone?: "light" | "dark";
};

export function PublicHeader({ subtitle, secondaryCtaLabel, secondaryCtaTo, tone = "light" }: PublicHeaderProps) {
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const isDark = tone === "dark";

  return (
    <nav
      className={
        isDark
          ? "sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl"
          : "sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-sm"
      }
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-display text-ember">Azeroth Flip</p>
          <p className={isDark ? "text-xs leading-tight text-zinc-400" : "text-xs leading-tight text-slate-500"}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className={isDark ? "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white" : ""}
            onClick={() => navigate(secondaryCtaTo)}
          >
            {secondaryCtaLabel}
          </Button>
          {session ? (
            <>
              {user?.email ? <span className={isDark ? "hidden text-sm text-zinc-300 md:inline" : "hidden text-sm text-slate-600 md:inline"}>{user.email}</span> : null}
              <Button
                variant="primary"
                size="sm"
                className={isDark ? "border-orange-500 bg-orange-500 text-white shadow-[0_0_28px_rgba(249,115,22,0.35)] hover:bg-orange-400" : ""}
                onClick={() => navigate("/app")}
              >
                Open app
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className={isDark ? "border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-white" : ""}
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}