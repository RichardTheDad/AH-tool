import { type FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

export function Login() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    if (mode === "signup") {
      const { error: authError } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (authError) setError(authError.message);
      else setMessage("Check your email for a confirmation link.");
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (authError) setError(authError.message);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (authError) setError(authError.message);
    else setMessage("Password reset link sent — check your email.");
  }

  async function handleDiscordLogin() {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/50 bg-white/60 p-8 shadow-lg backdrop-blur-md">
        <div className="space-y-1">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ember">AzerothFlip</p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ember focus:ring-1 focus:ring-ember"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-sm text-slate-500">
              <button type="button" onClick={() => { setMode("signin"); setError(null); setMessage(null); }} className="font-medium text-ember hover:underline">
                Back to sign in
              </button>
            </p>
          </form>
        ) : (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ember focus:ring-1 focus:ring-ember"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); setMessage(null); }}
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
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ember focus:ring-1 focus:ring-ember"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-50"
          >
            {loading ? (mode === "signup" ? "Creating account…" : "Signing in…") : (mode === "signup" ? "Create account" : "Sign in")}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          {mode === "signin" ? (
            <>No account?{" "}
              <button type="button" onClick={() => { setMode("signup"); setError(null); setMessage(null); }} className="font-medium text-ember hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button type="button" onClick={() => { setMode("signin"); setError(null); setMessage(null); }} className="font-medium text-ember hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
        )} {/* end signin/signup form */}

        {mode !== "forgot" && (<>
        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleDiscordLogin}
          className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Continue with Discord
        </button>
        </>)} {/* end non-forgot section */}
      </div>
    </div>
  );
}
