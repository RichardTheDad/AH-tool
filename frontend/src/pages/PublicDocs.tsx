import { Card } from "../components/common/Card";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PublicDocs() {
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

  const scannerWorkflow = [
    {
      step: "1. Select realms",
      description: "Choose your buy source realm(s) and sell destination realm(s).",
    },
    {
      step: "2. Fetch prices",
      description: "App retrieves live auction house prices for all items across your selected realms.",
    },
    {
      step: "3. Compare spreads",
      description: "Identifies the cheapest buy price for each item and finds the best sell opportunity across your enabled realms.",
    },
    {
      step: "4. Score & rank",
      description: "Calculates profit, ROI, confidence, and sellability for each opportunity. Results ranked by profit potential and market reliability.",
    },
    {
      step: "5. Filter results",
      description: "Apply your filters (profit minimum, ROI threshold, confidence level, risk tolerance) to narrow down actionable flips.",
    },
    {
      step: "6. Execute",
      description: "Review rankings, understand why each item is scored where it is, and post efficiently on your target realms.",
    },
  ];

  const resultFields = [
    {
      field: "Profit",
      meaning: "Gold you keep after buying, posting fees, and selling. This is the net gain per item transaction.",
    },
    {
      field: "ROI",
      meaning: "Return on investment as a percentage. Calculated as (Profit ÷ Buy Price) × 100. Higher ROI means better capital efficiency.",
    },
    {
      field: "Confidence",
      meaning: "How reliable this profit estimate is (0–100 scale). Builds from fresh market data (within 1 hour), consistent sell-side depth, and stable pricing history. Higher confidence = more trustworthy prediction.",
    },
    {
      field: "Sellability",
      meaning: "How likely you'll sell at your target price (0–100 scale). Based on the number of active sellers at that price point, historical sell-through rates for that item, and market stability. Higher sellability = easier to move inventory.",
    },
    {
      field: "Spread",
      meaning: "Price difference between the cheapest buy realm and best sell realm. Larger spreads create more profit opportunity.",
    },
    {
      field: "Risk",
      meaning: "Markets flagged as risky have thin buy-side depth, sudden price spikes, or unusual trading patterns. Risky opportunities rank lower and should be approached cautiously.",
    },
  ];

  const filterDescriptions = [
    {
      filter: "Profit Filter",
      purpose: "Set a minimum gold amount. Only shows opportunities worth X gold or more per item.",
    },
    {
      filter: "ROI Filter",
      purpose: "Set a minimum return percentage. Only shows opportunities with ROI above X%, helping you focus on efficient capital use.",
    },
    {
      filter: "Confidence Filter",
      purpose: "Set a minimum confidence score (0–100). Filters to only high-confidence predictions you can trust, reducing guesswork.",
    },
    {
      filter: "Risk Filter",
      purpose: "Toggle whether to include flagged/risky markets. Disable to avoid markets with thin inventory, spiky pricing, or suspicious patterns.",
    },
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
          title="How the scanner works"
          subtitle="The user workflow from setup to execution."
        >
          <div className="space-y-3">
            {scannerWorkflow.map((item) => (
              <div key={item.step} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.step}</p>
                <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
              </div>
            ))}
            <div className="mt-4 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-200">
              <p className="font-medium">Example</p>
              <p className="mt-1">Buy Stormscale Boots from Stormrage at 26,000g → Sell on Area 52 at 38,400g → 12,400g profit (47% after fees) with 84/100 confidence because Area 52 has strong sell-side depth.</p>
            </div>
          </div>
        </Card>

        <Card
          title="Understanding results"
          subtitle="What each scanner column means and why it matters."
        >
          <div className="space-y-3">
            {resultFields.map((item) => (
              <div key={item.field} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.field}</p>
                <p className="mt-1 text-sm text-zinc-400">{item.meaning}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Filters & controls"
          subtitle="How to narrow down opportunities to fit your strategy."
        >
          <div className="space-y-3">
            {filterDescriptions.map((item) => (
              <div key={item.filter} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.filter}</p>
                <p className="mt-1 text-sm text-zinc-400">{item.purpose}</p>
              </div>
            ))}
          </div>
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
