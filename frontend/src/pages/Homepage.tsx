import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Link } from "../components/common/Link";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function Homepage() {
  // This is a public page, not noindex
  useDocumentTitle("/", { 
    title: "Azeroth Flip - WoW Market Flipping Tool",
    description: "Find profitable market opportunities in World of Warcraft. Monitor realm markets, track price trends, and optimize your gold strategies with real-time auction house data.",
  });

  const featureCards = [
    {
      title: "Real-Time Analytics",
      description: "Monitor auction house prices across tracked realms with fresh scan snapshots and cross-realm spread visibility.",
      badge: "Live scan surface",
    },
    {
      title: "Smart Filtering",
      description: "Apply confidence, ROI, and risk filters to focus only on opportunities that fit your trading style.",
      badge: "Preset-ready workflows",
    },
    {
      title: "Realm Discovery",
      description: "Identify high-opportunity realms from scanner output and suggested-realm insights without manual guesswork.",
      badge: "Cross-realm edge",
    },
  ];

  const steps = [
    {
      title: "Connect and track realms",
      description: "Enable the realms you trade in so scans can compare buy and sell edges across your market coverage.",
    },
    {
      title: "Set your quality bar",
      description: "Tune minimum profit, ROI, confidence, and risk to fit your bankroll and posting strategy.",
    },
    {
      title: "Scan and prioritize",
      description: "Review ranked opportunities, inspect movement since last scan, and focus on the highest-signal flips first.",
    },
    {
      title: "Execute with context",
      description: "Use realm-level pricing context and item details to post smarter and capture spread efficiently.",
    },
  ];

  return (
    <div className="min-h-screen">
      <PublicHeader subtitle="Cross-realm scanner" secondaryCtaLabel="Documentation" secondaryCtaTo="/public/docs" />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          className="overflow-hidden"
          title="A better scanner workflow for serious gold makers"
          subtitle="Scan cross-realm opportunities, compare deltas between runs, and act on high-confidence flips faster."
        >
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Azeroth Flip keeps market decisions crisp: ranked opportunities, confidence-weighted scoring, and clear movement between scans.
                No bloated dashboards, just the signal you need to choose what to post next.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Profit + ROI aware</span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Confidence scoring</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Risk filters</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">Realm comparison</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/login" variant="default">
                  <Button variant="primary">Open scanner</Button>
                </Link>
                <Link to="/public/docs" variant="default">
                  <Button variant="secondary">Read docs</Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-label text-slate-500">Use case</p>
                <p className="mt-1 font-medium text-ink">Find cross-realm buy/sell spreads quickly</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-label text-slate-500">Workflow</p>
                <p className="mt-1 font-medium text-ink">Filter → scan → compare change summary → execute</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-label text-slate-500">Built for</p>
                <p className="mt-1 font-medium text-ink">Repeatable decisions, not one-off guesswork</p>
              </div>
            </div>
          </div>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <Card key={card.title} title={card.title} className="h-full" variant="default">
              <p className="mb-3 text-sm text-slate-700">{card.description}</p>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                {card.badge}
              </span>
            </Card>
          ))}
        </section>

        <Card title="How the flow works" subtitle="Compact, repeatable loop from setup to execution.">
          <div className="grid gap-2 md:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ember/30 bg-ember/10 text-xs font-semibold text-ember">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1 text-xs text-slate-600">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card variant="flat" className="border-slate-300" title="Designed for repeatable execution">
          <p className="text-sm text-slate-700">
            Public pages explain what the platform does. The authenticated workspace focuses on doing the work:
            scan, compare, decide, and post. No duplicated marketing layers after login.
          </p>
        </Card>
      </main>
    </div>
  );
}
