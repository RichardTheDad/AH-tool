import { useNavigate } from "react-router-dom";
import { Button } from "../common/Button";
import { useAuth } from "../../contexts/AuthContext";

type PublicHeaderProps = {
  subtitle: string;
  secondaryCtaLabel: string;
  secondaryCtaTo: string;
};

export function PublicHeader({ subtitle, secondaryCtaLabel, secondaryCtaTo }: PublicHeaderProps) {
  const navigate = useNavigate();
  const { user, session } = useAuth();

  return (
    <nav className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-display text-ember">Azeroth Flip</p>
          <p className="text-xs leading-tight text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate(secondaryCtaTo)}>
            {secondaryCtaLabel}
          </Button>
          {session ? (
            <>
              {user?.email ? <span className="hidden text-sm text-slate-600 md:inline">{user.email}</span> : null}
              <Button variant="primary" size="sm" onClick={() => navigate("/app")}>
                Open app
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => navigate("/login")}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}