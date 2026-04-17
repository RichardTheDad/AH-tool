import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");

  useDocumentTitle("/login");

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null
  );
  const [loading, setLoading] = useState(false);

  function switchMode(next: "signin" | "signup" | "forgot") {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        setLoading(false);
        if (authError) setError(authError.message);
        else setMessage("Password reset link sent — check your email.");
      } else if (mode === "signup") {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        setLoading(false);
        if (authError) setError(authError.message);
        else setMessage("Check your email for a confirmation link.");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (authError) setError(authError.message);
        else if (!data.session) setError("Sign in succeeded but no session was returned — check Supabase Auth settings.");
      }
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Unexpected error — check browser console.");
    }
  }

  async function handleDiscordLogin() {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
  }

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";
  const submitLabel = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link";
  const submitLoadingLabel = mode === "signin" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending…";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/15 bg-zinc-900/60 p-6 shadow-lg backdrop-blur-xl sm:p-8">
        <div className="space-y-1">
          <p className="font-display text-xs uppercase tracking-wider text-ember font-semibold">Azeroth Flip</p>
          <h1 className="font-display text-2xl font-semibold text-zinc-100">{title}</h1>
          <p className="text-sm text-zinc-400">Accounts sync realms and presets across devices. You can still use the scanner as a guest.</p>
          <div className="pt-1">
            <Link to="/home" className="text-sm font-medium text-ember hover:underline">
              Back to Home
            </Link>
          </div>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-ember focus:ring-1 focus:ring-ember/30"
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-200">
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-xs text-ember hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-ember focus:ring-1 focus:ring-ember/30"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {loading ? submitLoadingLabel : submitLabel}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          {mode === "signin" && (
            <>No account?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="font-medium text-ember hover:underline">
                Sign up
              </button>
            </>
          )}
          {mode === "signup" && (
            <>Already have an account?{" "}
              <button type="button" onClick={() => switchMode("signin")} className="font-medium text-ember hover:underline">
                Sign in
              </button>
            </>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => switchMode("signin")} className="font-medium text-ember hover:underline">
              Back to sign in
            </button>
          )}
        </p>

        <p className="text-center text-xs text-zinc-500">
          Browse without an account in <Link to="/app" className="text-ember hover:underline">guest mode</Link>. Read the <Link to="/privacy" className="text-ember hover:underline">Privacy Policy</Link>.
        </p>

        {mode !== "forgot" && (
          <>
            <Link
              to="/app"
              className="block w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Continue as Guest
            </Link>

            <div className="relative flex items-center gap-3">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-xs text-zinc-500">or</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            <button
              type="button"
              onClick={handleDiscordLogin}
              className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Continue with Discord
            </button>
          </>
        )}
      </div>
    </div>
  );
}
