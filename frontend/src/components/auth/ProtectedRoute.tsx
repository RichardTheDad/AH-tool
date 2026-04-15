import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { PropsWithChildren } from "react";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-zinc-400">Loading…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
