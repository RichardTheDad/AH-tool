import { useNavigate } from "react-router-dom";
import { Button } from "../common/Button";

type PublicHeaderProps = {
  subtitle: string;
  secondaryCtaLabel: string;
  secondaryCtaTo: string;
};

export function PublicHeader({ subtitle, secondaryCtaLabel, secondaryCtaTo }: PublicHeaderProps) {
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-xs uppercase tracking-display text-ember">Azeroth Flip</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(secondaryCtaTo)}>
            {secondaryCtaLabel}
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate("/login")}>
            Sign in
          </Button>
        </div>
      </div>
    </nav>
  );
}