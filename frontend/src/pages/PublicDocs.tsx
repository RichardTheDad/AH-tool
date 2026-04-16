import { Card } from "../components/common/Card";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PublicDocs() {
  // This is a public overview page, not noindex
  useDocumentTitle("/public/docs", {
    title: "How It Works - Azeroth Flip",
    description: "High-level overview of how Azeroth Flip helps users evaluate cross-realm opportunities while protecting private operational detail.",
  });

  const coreFeatures = [
    "Opportunity ranking across your enabled realms",
    "Filter controls for profit, ROI, confidence, and risk preferences",
    "Realm management for tracking where you source and where you sell",
    "Preset workflows for quickly switching between scanner views",
    "Item-level context to support better buy and sell decisions",
  ];

  const privateDataItems = [
    "Tracked realms and user preferences",
    "Custom scanner filters and presets",
    "Scan results and profit opportunity history",
    "Account settings and authentication tokens",
  ];

  const trustBoundaries = [
    ["Public", "Product overview and general capability information."],
    ["Authenticated", "Scanner operations, account configuration, and personal data views."],
    ["Protected", "Operational internals, private scoring inputs, and account-linked activity."],
  ] as const;

  const highLevelLimits = [
    "Market outcomes can change quickly and are never guaranteed.",
    "Data availability may vary based on upstream provider reliability.",
    "Very recent content may take time to appear consistently in market views.",
  ];

  return (
    <div className="min-h-screen">
      <PublicHeader subtitle="How it works" secondaryCtaLabel="Home" secondaryCtaTo="/home" />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          title="How Azeroth Flip works"
          subtitle="A high-level overview of capabilities and trust boundaries."
        >
          <p className="text-sm text-zinc-300 mb-3">
            Azeroth Flip helps users evaluate cross-realm market opportunities by combining pricing context, configurable filters, and ranked scanner output.
          </p>
          <p className="text-sm text-zinc-300">
            The public page intentionally stays high-level. Detailed implementation flow and operational internals are not published here.
          </p>
        </Card>

        <Card title="What users can do">
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
          title="Trust and privacy boundaries"
          subtitle="What is public versus what is private inside the product."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Access levels</h3>
              <div className="space-y-2">
                {trustBoundaries.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <p className="font-medium text-zinc-100">{label}</p>
                    <p className="text-zinc-400">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Private account data</h3>
              <div className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm text-sky-200 mb-2">
                Public content is limited to product overview and trust guidance.
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

        <Card title="Important notes" variant="flat">
          <ul className="space-y-2 text-sm text-zinc-300">
            {highLevelLimits.map((entry) => (
              <li key={entry} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                {entry}
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
