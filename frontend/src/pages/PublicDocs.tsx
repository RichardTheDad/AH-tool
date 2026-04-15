import { Card } from "../components/common/Card";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PublicDocs() {
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
      <PublicHeader subtitle="Public documentation" secondaryCtaLabel="Home" secondaryCtaTo="/home" />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          title="Azeroth Flip Documentation"
          subtitle="Public documentation for product capabilities, freshness, trust boundaries, and API surface."
        >
          <p className="text-sm text-zinc-300 mb-3">
            Azeroth Flip is a real-time World of Warcraft auction house monitoring and analysis platform. It helps gold traders identify profitable flipping opportunities by analyzing market trends, price patterns, and profit margins across WoW realms.
          </p>
          <p className="text-sm text-zinc-300">
            The platform continuously scans auction house data and surfaces opportunities matching user-defined profit criteria, enabling traders to execute profitable transactions efficiently.
          </p>
        </Card>

        <Card title="Core features">
          <ul className="space-y-2 text-sm text-zinc-300">
            {coreFeatures.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="mt-0.5 text-emerald-300">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Data, freshness, and privacy"
          subtitle="How data enters the system, how fresh it is, and what remains private."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Freshness schedule</h3>
              <div className="space-y-2">
                {freshnessRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <p className="font-medium text-zinc-100">{label}</p>
                    <p className="text-zinc-400">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Data sources</h3>
              <div className="space-y-2">
                {dataSources.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <p className="font-medium text-zinc-100">{label}</p>
                    <p className="text-zinc-400">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Privacy boundaries</h3>
              <div className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm text-sky-200 mb-2">
                Public data: documentation and product overview only.
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-label text-zinc-500">Private data</p>
                <ul className="mt-1 space-y-1 text-sm text-zinc-300">
                  {privateDataItems.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Private data is accessible only through authenticated API calls with per-user rate limiting.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Known limitations" variant="flat">
          <div className="space-y-2">
            {limitations.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-100">{label}</p>
                <p className="text-zinc-400">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="API capabilities">
          <p className="mb-3 text-sm text-zinc-300">
            Azeroth Flip provides a comprehensive REST API for authenticated users to programmatically access their account and market data.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {apiCapabilities.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-100">{label}</p>
                <p className="text-zinc-400">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-300 mt-3">
            All API endpoints are rate-limited and require authentication via Supabase JWT tokens. Documentation available upon account creation.
          </p>
        </Card>
      </main>
    </div>
  );
}
