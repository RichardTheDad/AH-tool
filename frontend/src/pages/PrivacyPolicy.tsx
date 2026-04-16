import { Card } from "../components/common/Card";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "react-router-dom";

export function PrivacyPolicy() {
  useDocumentTitle("/privacy");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <PublicHeader
        subtitle="What Azeroth Flip stores, what stays in your browser, and how accounts work."
        secondaryCtaLabel="How it works"
        secondaryCtaTo="/HowItWorks"
      />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card title="Privacy policy" subtitle="Effective April 16, 2026.">
          <div className="space-y-4 text-sm leading-6 text-zinc-300">
            <p>Azeroth Flip is built to work with minimal personal data. We do not run analytics trackers, ad networks, or third-party marketing pixels, and we do not sell your data.</p>
            <p>You can use the scanner without creating an account. In guest mode, your saved realms, presets, and filter state are stored only in your browser. If you clear site data or switch devices, that guest data is lost.</p>
            <p>If you create an account, we store the minimum needed to provide synced features like saved realms and presets across devices.</p>
            <div>
              <Link
                to="/home"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="What we collect">
            <div className="space-y-3 text-sm leading-6 text-zinc-300">
              <p>Account holders provide an email address to Supabase Authentication.</p>
              <p>Saved app data can include tracked realms, scanner presets, and related account preferences.</p>
              <p>Market data shown in the scanner comes from public World of Warcraft auction data and related item metadata, not from your private gameplay account.</p>
            </div>
          </Card>

          <Card title="Passwords and authentication">
            <div className="space-y-3 text-sm leading-6 text-zinc-300">
              <p>Passwords are handled by Supabase Authentication, not by our backend application.</p>
              <p>Supabase stores passwords as one-way salted password hashes, not as decryptable plain text. This means the original password cannot be read back from storage.</p>
              <p>Password submissions are sent over HTTPS/TLS in transit, and our application database does not store reusable password values.</p>
              <p>Signed-in users can change their password from the Account page in the app.</p>
              <p>Discord sign-in is handled through Supabase OAuth and Discord's authorization flow.</p>
            </div>
          </Card>

          <Card title="Cookies and browser storage">
            <div className="space-y-3 text-sm leading-6 text-zinc-300">
              <p>We do not use advertising or tracking cookies.</p>
              <p>Guest mode uses browser storage so your local realms and presets survive refreshes on the same device.</p>
              <p>If you sign in, Supabase may use browser storage to keep your session active.</p>
            </div>
          </Card>

          <Card title="Why an account exists">
            <div className="space-y-3 text-sm leading-6 text-zinc-300">
              <p>An account is optional for browsing the scanner.</p>
              <p>An account is only needed if you want your realms and presets to sync across devices or persist independently from one browser cache.</p>
              <p>Auth-protected areas that rely on user-specific server data may still require sign-in.</p>
            </div>
          </Card>
        </div>

        <Card title="Data sharing, retention, and deletion">
          <div className="space-y-3 text-sm leading-6 text-zinc-300">
            <p>We do not sell personal data and do not share account information for advertising.</p>
            <p>Operational scan data is retained to keep the scanner useful and is pruned automatically over time. Account-specific saved data is not exposed publicly.</p>
            <p>Signed-in users can permanently delete their account from the Account page. Deletion removes account data from this app and requests account removal from Supabase Authentication.</p>
          </div>
        </Card>
      </main>
    </div>
  );
}
