import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Link } from "../components/common/Link";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type PreviewRow = {
  item: string;
  buyRealm: string;
  sellRealm: string;
  profit: string;
  roi: string;
  confidence: string;
};

export function Homepage() {
  // This is a public page, not noindex
  useDocumentTitle("/", { 
    title: "Azeroth Flip - WoW Market Flipping Tool",
    description: "Find profitable market opportunities in World of Warcraft. Monitor realm markets, track price trends, and optimize your gold strategies with real-time auction house data.",
  });

  const featureCards = [
    {
      title: "Find profitable spreads fast",
      description: "Compare buy and sell listings across realms to surface stronger arbitrage opportunities quickly.",
    },
    {
      title: "Filter out bad flips",
      description: "Set ROI, profit, confidence, and risk thresholds to remove low-quality opportunities.",
    },
    {
      title: "Spot stronger destination realms",
      description: "See where demand and spread quality align so you can route flips to better sell-side markets.",
    },
  ];

  const steps = [
    {
      title: "Add realms",
      description: "Select your buy and sell realms.",
    },
    {
      title: "Set filters",
      description: "Tune ROI, profit, and risk thresholds.",
    },
    {
      title: "Scan opportunities",
      description: "Rank higher-confidence flips.",
    },
    {
      title: "Execute flips",
      description: "Use item context and post efficiently.",
    },
  ];

  const previewRows: PreviewRow[] = [
    {
      item: "Stormscale Boots",
      buyRealm: "Stormrage",
      sellRealm: "Area 52",
      profit: "12,400g",
      roi: "31%",
      confidence: "84",
    },
    {
      item: "Siren's Ruby Ring",
      buyRealm: "Tichondrius",
      sellRealm: "Illidan",
      profit: "9,850g",
      roi: "24%",
      confidence: "78",
    },
    {
      item: "Runebound Chestplate",
      buyRealm: "Frostmourne",
      sellRealm: "Sargeras",
      profit: "7,600g",
      roi: "19%",
      confidence: "72",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(213,173,109,0.16),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(184,88,42,0.11),transparent_38%),linear-gradient(180deg,#fcf6eb_0%,#fffaf2_48%,#fffdf8_100%)]">
      <PublicHeader subtitle="Cross-realm scanner" secondaryCtaLabel="Documentation" secondaryCtaTo="/public/docs" />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          className="overflow-hidden"
          title="Find cross-realm flips faster"
          subtitle="Compare buy vs. sell realms, track price movement between scans, and focus on higher-confidence opportunities."
        >
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
            <div className="space-y-4">
              <p className="max-w-xl text-base leading-relaxed text-slate-700">
                Azeroth Flip is built around scanner decisions: where to buy, where to sell, and which items still hold believable spread after fees and risk filters.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Compare realms</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">Rank by confidence</span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Track scan deltas</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link to="/login" variant="default">
                  <Button variant="primary" size="lg">Open scanner</Button>
                </Link>
                <Link to="/public/docs" variant="default">
                  <Button variant="secondary" size="lg">Read docs</Button>
                </Link>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
                <p>
                  Feel free to donate. Support helps expand infrastructure so Azeroth Flip can process more scan data.
                  {" "}
                  <Link
                    to="https://ko-fi.com/richardthedad"
                    external
                    className="font-semibold text-ember hover:text-ink"
                  >
                    Donate on Ko-fi
                  </Link>
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">Static product preview</p>
                  <p className="text-xs text-slate-600">Scanner-style row ranking</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">Demo</span>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="grid grid-cols-[1.9fr_1fr_1fr_1.2fr_0.9fr] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <span>Item</span>
                  <span>Buy</span>
                  <span>Sell</span>
                  <span>Profit / ROI</span>
                  <span>Confidence</span>
                </div>
                {previewRows.map((row) => (
                  <div key={row.item} className="grid grid-cols-[1.9fr_1fr_1fr_1.2fr_0.9fr] items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                    <span className="truncate pr-2 font-semibold text-ink">{row.item}</span>
                    <span className="text-slate-700">{row.buyRealm}</span>
                    <span className="text-slate-700">{row.sellRealm}</span>
                    <span className="text-emerald-700">
                      <span className="font-semibold">{row.profit}</span>
                      <span className="ml-1 text-slate-500">{row.roi}</span>
                    </span>
                    <span>
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">{row.confidence}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-4">
                <div>
                  <p className="font-semibold text-ink">Tracked realms</p>
                  <p>Configured in app</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Filter controls</p>
                  <p>ROI, profit, risk</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Scan cadence</p>
                  <p>Scheduled + manual</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Ranking model</p>
                  <p>Confidence-aware</p>
                </div>
              </div>
            </section>
          </div>
        </Card>

        <section className="grid gap-3 md:grid-cols-3">
          {featureCards.map((card) => (
            <Card key={card.title} title={card.title} className="h-full" variant="default">
              <p className="text-sm leading-relaxed text-slate-700">{card.description}</p>
            </Card>
          ))}
        </section>

        <Card title="How it works" subtitle="A compact loop you can repeat every scan cycle.">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.title} className="relative rounded-xl border border-slate-200 bg-white px-3 py-3">
                  {index < steps.length - 1 ? (
                    <span className="pointer-events-none absolute -right-2 top-7 hidden text-amber-400 xl:inline">-&gt;</span>
                  ) : null}
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ember/35 bg-ember/10 text-xs font-semibold text-ember">
                      {index + 1}
                    </div>
                    <h3 className="font-display text-base font-semibold leading-tight text-ink">{step.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-2">
                  <span className="text-amber-700">+</span>
                  <span>Tracked realms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700">+</span>
                  <span>Scanned items</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700">+</span>
                  <span>Last scan freshness</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700">+</span>
                  <span>Confidence-based ranking</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
