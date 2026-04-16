import { useNavigate } from "react-router-dom";
import { Button } from "../common/Button";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "../common/Link";

type PublicHeaderProps = {
  subtitle: string;
  secondaryCtaLabel: string;
  secondaryCtaTo: string;
};

export function PublicHeader({ subtitle, secondaryCtaLabel, secondaryCtaTo }: PublicHeaderProps) {
  const navigate = useNavigate();
  const { user, session } = useAuth();

  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-display text-ember">Azeroth Flip</p>
          <p className="text-sm leading-tight text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="https://ko-fi.com/richardthedad"
            external
            variant="muted"
            className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 no-underline hover:border-orange-400/45 hover:text-orange-300 sm:inline-flex"
          >
            <img src="/kofi-logo.svg" alt="Ko-fi" className="h-4 w-4" />
            Support on Ko-fi
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
            onClick={() => navigate(secondaryCtaTo)}
          >
            {secondaryCtaLabel}
          </Button>
          {session ? (
            <>
              {user?.email ? <span className="hidden text-sm text-zinc-300 md:inline">{user.email}</span> : null}
              <Button
                variant="primary"
                size="sm"
                className="border-orange-500 bg-orange-500 text-white shadow-[0_0_28px_rgba(249,115,22,0.2)] hover:bg-orange-400"
                onClick={() => navigate("/app")}
              >
                Open app
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-white"
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