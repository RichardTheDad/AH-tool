import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAccount } from "../api/account";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";

export function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("/app/account");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await signOut();
      navigate("/home", { replace: true });
    },
    onError: (error: Error) => setDeleteError(error.message),
  });

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password updated successfully.");
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    const confirmed = window.confirm(
      "Delete your account? This permanently removes your account and saved app data. This action cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Account" subtitle="Manage your sign-in security and account lifecycle.">
        <div className="space-y-3 text-sm text-zinc-300">
          <p>Signed in as {user?.email ?? "unknown user"}</p>
          <p>Use this page to change your password or permanently delete your account.</p>
        </div>
      </Card>

      <Card title="Change password" subtitle="Update your Supabase account password.">
        <form className="space-y-3" onSubmit={handlePasswordSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-200" htmlFor="account-new-password">
              New password
            </label>
            <input
              id="account-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-ember focus:ring-1 focus:ring-ember/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-200" htmlFor="account-confirm-password">
              Confirm new password
            </label>
            <input
              id="account-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-ember focus:ring-1 focus:ring-ember/30"
            />
          </div>
          {passwordError ? <p className="text-sm text-rose-400">{passwordError}</p> : null}
          {passwordMessage ? <p className="text-sm text-emerald-400">{passwordMessage}</p> : null}
          <Button type="submit" variant="secondary" size="sm">Update password</Button>
        </form>
      </Card>

      <Card title="Delete account" subtitle="Permanently remove your account and saved app data.">
        <div className="space-y-3">
          <p className="text-sm text-zinc-300">
            This permanently removes your account from Supabase Authentication and deletes your saved realms, presets, settings,
            and related account data from this app.
          </p>
          {deleteError ? <p className="text-sm text-rose-400">{deleteError}</p> : null}
          <Button variant="danger" size="sm" onClick={handleDeleteAccount} isLoading={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting account..." : "Delete account"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
