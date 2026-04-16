import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { PropsWithChildren } from "react";

interface ProtectedRouteProps extends PropsWithChildren {
  guestAllowed?: boolean;
  redirectTo?: string;
}

export function ProtectedRoute({ children, guestAllowed = false, redirectTo = "/home" }: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-zinc-400">Loading…</span>
      </div>
    );
  }

  if (!session && !guestAllowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
