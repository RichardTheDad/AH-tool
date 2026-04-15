import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PublicDocs() {
  const navigate = useNavigate();

  // This is a public docs page, not noindex
  useDocumentTitle("/public/docs", {
    title: "Documentation - AzerothFlipLocal",
    description: "Public documentation for AzerothFlipLocal. Learn about features, data freshness, API capabilities, and trust boundaries.",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="text-xl font-bold text-ember hover:text-ember/80 transition"
          >
            ← Back to Home
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold mb-2">AzerothFlipLocal Documentation</h1>
        <p className="text-slate-300 mb-12">Public documentation for product features, data freshness, and trust boundaries.</p>

        {/* Product Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-ember">Product Overview</h2>
          <p className="text-slate-300 mb-4">
            AzerothFlipLocal is a real-time World of Warcraft auction house monitoring and analysis platform. It helps gold traders identify profitable flipping opportunities by analyzing market trends, price patterns, and profit margins across WoW realms.
          </p>
          <p className="text-slate-300">
            The platform continuously scans auction house data and surfaces opportunities matching user-defined profit criteria, enabling traders to execute profitable transactions efficiently.
          </p>
        </section>

        {/* Core Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-ember">Core Features</h2>
          <ul className="space-y-3 text-slate-300">
            <li className="flex gap-3">
              <span className="text-ember">✓</span>
              <span><strong>Real-Time Scanner:</strong> Live auction house analysis with profit opportunity detection</span>
            </li>
            <li className="flex gap-3">
              <span className="text-ember">✓</span>
              <span><strong>Smart Filtering:</strong> Customizable profit targets, price thresholds, and item preferences</span>
            </li>
            <li className="flex gap-3">
              <span className="text-ember">✓</span>
              <span><strong>Realm Management:</strong> Multi-realm support with independent configuration per realm</span>
            </li>
            <li className="flex gap-3">
              <span className="text-ember">✓</span>
              <span><strong>Preset System:</strong> Save and manage scanner configurations for quick switching</span>
            </li>
            <li className="flex gap-3">
              <span className="text-ember">✓</span>
              <span><strong>Market Insights:</strong> Suggested realms based on market volatility and opportunity density</span>
            </li>
            <li className="flex gap-3">
              <span className="text-ember">✓</span>
              <span><strong>Item Details:</strong> Rich item metadata including historical pricing and trend analysis</span>
            </li>
          </ul>
        </section>

        {/* Data Freshness */}
        <section className="mb-12 border border-white/10 rounded-lg p-6 bg-white/5">
          <h2 className="text-2xl font-bold mb-4 text-ember">Data Freshness & Update Frequency</h2>
          <p className="text-slate-300 mb-4">
            AzerothFlipLocal maintains data freshness through scheduled market scans tied to user realm configurations. Here's our typical update schedule:
          </p>
          <ul className="space-y-3 text-slate-300 ml-4">
            <li><strong>Auction House Data:</strong> Updated hourly per realm (Blizzard API source)</li>
            <li><strong>Price History:</strong> Maintained with timestamps for trend analysis</li>
            <li><strong>Item Metadata:</strong> Refreshed weekly from Blizzard metadata endpoints</li>
            <li><strong>Realm Status:</strong> Checked on-demand and cached for 24 hours</li>
            <li><strong>Market Suggestions:</strong> Regenerated weekly after main scan cycles</li>
          </ul>
          <p className="text-slate-300 mt-4">
            Users can view the last scan timestamp for each realm in the app to understand data freshness at decision time.
          </p>
        </section>

        {/* Trust Boundaries */}
        <section className="mb-12 border border-white/10 rounded-lg p-6 bg-white/5">
          <h2 className="text-2xl font-bold mb-4 text-ember">Trust Boundaries & Security</h2>
          <p className="text-slate-300 mb-4">
            All user data is private and account-protected. AzerothFlipLocal does not share, sell, or expose user information.
          </p>
          <h3 className="text-lg font-semibold mb-3 text-slate-100">Public Data</h3>
          <p className="text-slate-300 mb-4">Only this documentation and product marketing materials are publicly indexable. No user-specific data is ever exposed.</p>
          <h3 className="text-lg font-semibold mb-3 text-slate-100">Private Data</h3>
          <ul className="space-y-2 text-slate-300 ml-4">
            <li>• Tracked realms and user preferences</li>
            <li>• Custom scanner filters and presets</li>
            <li>• Scan results and profit opportunity history</li>
            <li>• Account settings and authentication tokens</li>
          </ul>
          <p className="text-slate-300 mt-4">
            All private data is accessed only through authenticated API calls with per-user rate limiting to prevent abuse.
          </p>
        </section>

        {/* Data Sources */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-ember">Data Sources</h2>
          <ul className="space-y-3 text-slate-300">
            <li>
              <strong>Blizzard Auction House API:</strong> Real-time auction listings and price data for all realms
            </li>
            <li>
              <strong>Blizzard Item Metadata:</strong> Item names, icons, categories, and quality tiers
            </li>
            <li>
              <strong>Blizzard Realm Status:</strong> Realm population, timezone, and language metadata
            </li>
            <li>
              <strong>Internal Database:</strong> Scan history, user configurations, and cached market snapshots
            </li>
          </ul>
          <p className="text-slate-300 mt-4">
            All external data is sourced from official Blizzard APIs. Internal data is generated by legitimate market analysis and is retained with privacy guarantees.
          </p>
        </section>

        {/* Limitations */}
        <section className="mb-12 border border-white/10 rounded-lg p-6 bg-white/5">
          <h2 className="text-2xl font-bold mb-4 text-ember">Known Limitations</h2>
          <ul className="space-y-3 text-slate-300">
            <li>
              <strong>Blizzard API Availability:</strong> If Blizzard's API is down or rate-limited, scan updates may be delayed or fail gracefully.
            </li>
            <li>
              <strong>Data Latency:</strong> Auction house data in our platform reflects the last successful scan, not live wall-clock time. Prices may change between scans.
            </li>
            <li>
              <strong>Item Coverage:</strong> Very new items may not appear in Blizzard metadata for 24-48 hours after release.
            </li>
            <li>
              <strong>Cross-Realm Data:</strong> Connected realms are treated as separate entries; the app does not auto-consolidate pricing across connections.
            </li>
            <li>
              <strong>Historical Depth:</strong> Pricing history is retained for 90 days; older scans are archived or removed.
            </li>
          </ul>
        </section>

        {/* API Capabilities */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-ember">API Capabilities</h2>
          <p className="text-slate-300 mb-4">
            AzerothFlipLocal provides a comprehensive REST API for authenticated users to programmatically access their account and market data.
          </p>
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4 bg-white/5">
              <h3 className="font-semibold text-slate-100 mb-2">Health Check</h3>
              <p className="text-slate-300 text-sm">Public endpoint for monitoring service availability (no auth required)</p>
            </div>
            <div className="border border-white/10 rounded p-4 bg-white/5">
              <h3 className="font-semibold text-slate-100 mb-2">Scan Management</h3>
              <p className="text-slate-300 text-sm">Retrieve scan results, run on-demand scans, and manage scan history (authenticated)</p>
            </div>
            <div className="border border-white/10 rounded p-4 bg-white/5">
              <h3 className="font-semibold text-slate-100 mb-2">Realm Management</h3>
              <p className="text-slate-300 text-sm">List, add, and manage tracked realms and realm configurations (authenticated)</p>
            </div>
            <div className="border border-white/10 rounded p-4 bg-white/5">
              <h3 className="font-semibold text-slate-100 mb-2">Item & Market Data</h3>
              <p className="text-slate-300 text-sm">Query item details, pricing history, and trend analysis (authenticated)</p>
            </div>
            <div className="border border-white/10 rounded p-4 bg-white/5">
              <h3 className="font-semibold text-slate-100 mb-2">Presets & Settings</h3>
              <p className="text-slate-300 text-sm">Create, update, and manage filter presets and account settings (authenticated)</p>
            </div>
          </div>
          <p className="text-slate-300 text-sm mt-4">
            All API endpoints are rate-limited and require authentication via Supabase JWT tokens. Documentation available upon account creation.
          </p>
        </section>

        {/* Support & Feedback */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-ember">Support & Feedback</h2>
          <p className="text-slate-300">
            Found an issue or have a feature request? We'd love to hear from you. Issues and feature ideas are tracked internally and prioritized based on user impact.
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-8 mt-12 text-slate-400 text-sm">
          <p>© 2026 AzerothFlipLocal. World of Warcraft is a trademark of Blizzard Entertainment.</p>
          <p className="text-slate-500 text-xs mt-2">
            This documentation reflects the current state as of April 15, 2026. For the latest information, please visit the app directly.
          </p>
        </footer>
      </div>
    </div>
  );
}
