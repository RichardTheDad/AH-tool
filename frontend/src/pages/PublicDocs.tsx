import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PublicDocs() {
  const navigate = useNavigate();

  // This is a public docs page, not noindex
  useDocumentTitle("/public/docs", {
    title: "Documentation - Azeroth Flip",
    description: "Public documentation for Azeroth Flip. Learn about features, data freshness, API capabilities, and trust boundaries.",
  });

  const coreFeatures = [
    "Real-Time Scanner: Live auction house analysis with profit opportunity detection",
    "Smart Filtering: Customizable profit targets, price thresholds, and item preferences",
    "Realm Management: Multi-realm support with independent configuration per realm",
    "Preset System: Save and manage scanner configurations for quick switching",
    "Market Insights: Suggested realms based on market volatility and opportunity density",
    "Item Details: Rich item metadata including historical pricing and trend analysis",
  ];

  const freshnessRows = [
    ["Auction House Data", "Updated hourly per realm (Blizzard API source)"],
    ["Price History", "Maintained with timestamps for trend analysis"],
    ["Item Metadata", "Refreshed weekly from Blizzard metadata endpoints"],
    ["Realm Status", "Checked on-demand and cached for 24 hours"],
    ["Market Suggestions", "Regenerated weekly after main scan cycles"],
  ] as const;

  const privateDataItems = [
    "Tracked realms and user preferences",
    "Custom scanner filters and presets",
    "Scan results and profit opportunity history",
    "Account settings and authentication tokens",
  ];

  const dataSources = [
    ["Blizzard Auction House API", "Real-time auction listings and price data for all realms"],
    ["Blizzard Item Metadata", "Item names, icons, categories, and quality tiers"],
    ["Blizzard Realm Status", "Realm population, timezone, and language metadata"],
    ["Internal Database", "Scan history, user configurations, and cached market snapshots"],
  ] as const;

  const limitations = [
    ["Blizzard API Availability", "If Blizzard's API is down or rate-limited, scan updates may be delayed or fail gracefully."],
    ["Data Latency", "Auction house data reflects the last successful scan, not live wall-clock time."],
    ["Item Coverage", "Very new items may not appear in Blizzard metadata for 24-48 hours after release."],
    ["Cross-Realm Data", "Connected realms are treated as separate entries; pricing is not auto-consolidated."],
    ["Historical Depth", "Pricing history is retained for 90 days; older scans are archived or removed."],
  ] as const;

  const apiCapabilities = [
    ["Health Check", "Public endpoint for monitoring service availability (no auth required)"],
    ["Scan Management", "Retrieve scan results, run on-demand scans, and manage scan history (authenticated)"],
    ["Realm Management", "List, add, and manage tracked realms and realm configurations (authenticated)"],
    ["Item & Market Data", "Query item details, pricing history, and trend analysis (authenticated)"],
    ["Presets & Settings", "Create, update, and manage filter presets and account settings (authenticated)"],
  ] as const;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="font-display text-xs uppercase tracking-display text-ember">Azeroth Flip</p>
            <p className="text-xs text-slate-500">Public documentation</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate("/")}>Home</Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/login")}>Sign in</Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          title="Azeroth Flip Documentation"
          subtitle="Public documentation for product capabilities, freshness, trust boundaries, and API surface."
        >
          <p className="text-sm text-slate-700 mb-3">
            Azeroth Flip is a real-time World of Warcraft auction house monitoring and analysis platform. It helps gold traders identify profitable flipping opportunities by analyzing market trends, price patterns, and profit margins across WoW realms.
          </p>
          <p className="text-sm text-slate-700">
            The platform continuously scans auction house data and surfaces opportunities matching user-defined profit criteria, enabling traders to execute profitable transactions efficiently.
          </p>
        </Card>

        <Card title="Core features">
          <ul className="space-y-2 text-sm text-slate-700">
            {coreFeatures.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="mt-0.5 text-emerald-700">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Data freshness and update frequency" variant="default">
          <p className="mb-3 text-sm text-slate-700">
            Azeroth Flip maintains data freshness through scheduled market scans tied to user realm configurations. Here's our typical update schedule:
          </p>
          <div className="grid gap-2">
            {freshnessRows.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-ink">{label}</p>
                <p className="text-slate-600">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Users can view the last scan timestamp for each realm in the app to understand data freshness at decision time.
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Trust boundaries and security">
            <p className="mb-3 text-sm text-slate-700">
            All user data is private and account-protected. Azeroth Flip does not share, sell, or expose user information.
            </p>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 mb-2">
              Public data: documentation and product overview only.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-label text-slate-500">Private data</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {privateDataItems.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-sm text-slate-700">
            All private data is accessed only through authenticated API calls with per-user rate limiting to prevent abuse.
            </p>
          </Card>

          <Card title="Data sources">
            <div className="space-y-2">
              {dataSources.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-ink">{label}</p>
                  <p className="text-slate-600">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-700">
            All external data is sourced from official Blizzard APIs. Internal data is generated by legitimate market analysis and is retained with privacy guarantees.
            </p>
          </Card>
        </div>

        <Card title="Known limitations" variant="flat">
          <div className="space-y-2">
            {limitations.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-ink">{label}</p>
                <p className="text-slate-600">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="API capabilities">
          <p className="mb-3 text-sm text-slate-700">
            Azeroth Flip provides a comprehensive REST API for authenticated users to programmatically access their account and market data.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {apiCapabilities.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-ink">{label}</p>
                <p className="text-slate-600">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-700 mt-3">
            All API endpoints are rate-limited and require authentication via Supabase JWT tokens. Documentation available upon account creation.
          </p>
        </Card>

        <Card title="Support and feedback" variant="flat">
          <p className="text-sm text-slate-700">
            Found an issue or have a feature request? We'd love to hear from you. Issues and feature ideas are tracked internally and prioritized based on user impact.
          </p>
        </Card>
      </main>

      <footer className="border-t border-slate-200 bg-white/70 py-4">
        <div className="mx-auto w-full max-w-6xl px-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>© 2026 Azeroth Flip. World of Warcraft is a trademark of Blizzard Entertainment.</p>
          <p className="text-slate-500 mt-1">
            This documentation reflects the current state as of April 15, 2026. For the latest information, please visit the app directly.
          </p>
        </div>
      </footer>
    </div>
  );
}
