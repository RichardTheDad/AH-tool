import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      // Sign out cleanly then send to login with a success message.
      // Supabase invalidates the recovery session after updateUser, so we
      // redirect to login rather than relying on that session still being valid.
      await supabase.auth.signOut();
      navigate("/login", { state: { message: "Password updated — please sign in with your new password." } });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/50 bg-white/60 p-8 shadow-lg backdrop-blur-md">
        <div className="space-y-1">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ember">AzerothFlip</p>
          <h1 className="font-display text-2xl font-semibold text-ink">Set new password</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ember focus:ring-1 focus:ring-ember"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ember focus:ring-1 focus:ring-ember"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
