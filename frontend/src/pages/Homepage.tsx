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
  why: string;
};

export function Homepage() {
  // This is a public page, not noindex
  useDocumentTitle("/", { 
    title: "Azeroth Flip - WoW Market Flipping Tool",
    description: "Find profitable market opportunities in World of Warcraft. Monitor realm markets, track price trends, and optimize your gold strategies with real-time auction house data.",
  });

  const featureCards = [
    {
      title: "Compare spreads across realms",
      description: "Scan buy vs. sell pricing in one view to find stronger cross-realm spread setups.",
      cue: "Spread",
    },
    {
      title: "Remove low-confidence flips",
      description: "Filter by profit, ROI, confidence, and risk so weaker opportunities drop out early.",
      cue: "Filter",
    },
    {
      title: "See stronger sell-side markets",
      description: "Use ranked scanner output and realm context to route flips toward better destinations.",
      cue: "Route",
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
      why: "High spread with stable sell-side depth",
    },
    {
      item: "Siren's Ruby Ring",
      buyRealm: "Tichondrius",
      sellRealm: "Illidan",
      profit: "9,850g",
      roi: "24%",
      confidence: "78",
      why: "Consistent ROI after fee-adjusted target sell",
    },
    {
      item: "Runebound Chestplate",
      buyRealm: "Frostmourne",
      sellRealm: "Sargeras",
      profit: "7,600g",
      roi: "19%",
      confidence: "72",
      why: "Lower spread but cleaner execution profile",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(213,173,109,0.16),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(184,88,42,0.11),transparent_38%),linear-gradient(180deg,#fcf6eb_0%,#fffaf2_48%,#fffdf8_100%)]">
      <PublicHeader subtitle="Cross-realm scanner" secondaryCtaLabel="Documentation" secondaryCtaTo="/public/docs" />

      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          className="overflow-hidden border-slate-300/40"
        >
          <div className="grid items-start gap-7 lg:grid-cols-[0.95fr_1.2fr]">
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">Cross-realm scanner</p>
                <h1 className="max-w-xl font-display text-[2rem] font-bold leading-[1.12] text-ink sm:text-[2.35rem]">
                  Compare buy and sell realms in one scan, then rank better flips by spread, ROI, and confidence.
                </h1>
                <p className="max-w-xl text-[15px] leading-relaxed text-slate-700">
                  See where to source, where to post, and why each opportunity ranks where it does.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Buy vs sell comparison</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">Fee-aware profit ranking</span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Confidence-aware filters</span>
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

            <section className="rounded-2xl border border-slate-300/70 bg-white p-3 shadow-md">
              <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">Scanner preview</p>
                  <p className="text-xs text-slate-700">Ranked opportunities snapshot</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">Example scan</span>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="grid grid-cols-[2fr_1fr_1fr_1.3fr_0.9fr] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <span>Item</span>
                  <span>Buy</span>
                  <span>Sell</span>
                  <span>Profit / ROI</span>
                  <span>Confidence</span>
                </div>
                {previewRows.map((row, index) => (
                  <div key={row.item} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1.3fr_0.9fr] items-center gap-2 text-sm">
                      <span className="truncate pr-2 font-semibold text-ink">{row.item}</span>
                      <span className="text-slate-700">{row.buyRealm}</span>
                      <span className="text-slate-700">{row.sellRealm}</span>
                      <span className="text-emerald-700">
                        <span className="text-[15px] font-bold leading-none">{row.profit}</span>
                        <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">{row.roi}</span>
                      </span>
                      <span>
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">{row.confidence}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">Why it ranks: {row.why}</p>
                    {index === 0 ? (
                      <div className="mt-1.5 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Top spread and cleaner execution profile across selected realms.
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                <p className="font-semibold text-ink">Ranking signals used in scanner output</p>
                <p className="mt-0.5">Spread quality, fee-adjusted ROI, confidence score, and risk filter thresholds.</p>
              </div>
            </section>
          </div>
        </Card>

        <section className="grid gap-2.5 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-slate-200/90 bg-white/80 px-4 py-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                  {card.cue}
                </span>
                <h2 className="font-display text-[17px] font-semibold leading-tight text-ink">{card.title}</h2>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">{card.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-4 shadow-sm">
          <header className="mb-3">
            <h2 className="font-display text-xl font-semibold text-ink">How it works</h2>
            <p className="text-sm text-slate-600">Set up once, then repeat the same scan loop quickly.</p>
          </header>

          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="relative rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ember/30 bg-ember/10 text-[11px] font-semibold text-ember">
                    {index + 1}
                  </div>
                  <h3 className="font-display text-sm font-semibold text-ink">{step.title}</h3>
                </div>
                <p className="text-xs text-slate-600">{step.description}</p>
                {index < steps.length - 1 ? (
                  <span className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 text-amber-400 xl:inline">&gt;</span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="font-semibold text-ink">Capability:</span> Compare buy vs. sell realms</p>
              <p><span className="font-semibold text-ink">Coverage:</span> Scheduled and manual scans</p>
              <p><span className="font-semibold text-ink">Ranking:</span> Confidence-aware scoring</p>
              <p><span className="font-semibold text-ink">Control:</span> Filter by profit, ROI, and risk</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
