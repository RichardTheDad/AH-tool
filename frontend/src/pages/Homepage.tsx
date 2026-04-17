import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Badge } from "../components/common/Badge";
import { ScoreDial } from "../components/common/ScoreDial";
import { GoldAmount } from "../components/common/GoldAmount";
import { Link } from "react-router-dom";

type PreviewRow = {
  item: string;
  category: string;
  buyRealm: string;
  buyPrice: string;
  sellRealm: string;
  targetSell: string;
  profit: number;
  roi: string;
  confidence: number;
  sellability: number;
  turnoverLabel: string;
  why: string;
};

export function Homepage() {
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

  const previewRows: PreviewRow[] = [
    {
      item: "Stormscale Boots",
      category: "Armor",
      buyRealm: "Stormrage",
      buyPrice: "24,800g",
      sellRealm: "Area 52",
      targetSell: "44,900g",
      profit: 201000000,
      roi: "81%",
      confidence: 88,
      sellability: 84,
      turnoverLabel: "fast",
      why: "Wide spread with strong sell-side depth and steady undercut behavior",
    },
    {
      item: "Siren's Ruby Ring",
      category: "Gem",
      buyRealm: "Tichondrius",
      buyPrice: "18,600g",
      sellRealm: "Illidan",
      targetSell: "31,900g",
      profit: 133000000,
      roi: "71%",
      confidence: 82,
      sellability: 78,
      turnoverLabel: "steady",
      why: "Consistent fee-adjusted margin with repeatable sell-through at target range",
    },
    {
      item: "Runebound Chestplate",
      category: "Armor",
      buyRealm: "Frostmourne",
      buyPrice: "28,200g",
      sellRealm: "Sargeras",
      targetSell: "45,400g",
      profit: 172000000,
      roi: "61%",
      confidence: 79,
      sellability: 72,
      turnoverLabel: "moderate",
      why: "Higher margin route with moderate pace but reliable posting window",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_32%,rgba(249,115,22,0.22),transparent_45%),radial-gradient(circle_at_88%_85%,rgba(37,99,235,0.2),transparent_48%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:38px_38px]" />

      <PublicHeader subtitle="Cross-realm scanner" secondaryCtaLabel="How it works" secondaryCtaTo="/HowItWorks" />

      <main className="relative mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:p-5">
          <div className="grid items-start gap-6 lg:grid-cols-[0.95fr_1.2fr]">
            <div className="space-y-4">
              <div className="space-y-3">
                <h1 className="max-w-xl font-display text-[2.15rem] font-bold leading-[1.05] text-zinc-100 sm:text-[3.1rem]">
                  Compare buy and sell realms, <span className="text-orange-400">rank better flips.</span>
                </h1>
                <p className="max-w-xl text-[19px] leading-relaxed text-zinc-300">
                  See where to source, where to post, and exactly why each opportunity ranks where it does based on spread,
                  ROI, and risk.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[12px]">
                <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-semibold text-zinc-200">Buy vs sell matching</span>
                <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-semibold text-zinc-200">Fee-aware profit</span>
                <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-semibold text-zinc-200">Confidence scoring</span>
              </div>

            </div>

            <section className="rounded-2xl border border-orange-400/20 bg-zinc-950/75 p-3 shadow-[0_0_20px_rgba(249,115,22,0.03)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                  <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">Scanner view</span>
                </div>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
                  Scan complete
                </span>
              </div>

              <div className="space-y-2 md:hidden">
                {previewRows.map((row, index) => (
                  <article key={row.item} className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-100">{row.item}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone="neutral">{row.category}</Badge>
                          <Badge tone={index === 0 ? "success" : "warning"}>{index === 0 ? "stable" : "tradable"}</Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <GoldAmount value={row.profit} className="justify-end text-sm text-emerald-300" />
                        <span className="mt-1 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">{row.roi}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Buy</p>
                        <p className="mt-1 font-medium text-zinc-200">{row.buyRealm}</p>
                        <p className="text-xs text-zinc-500">{row.buyPrice}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Sell</p>
                        <p className="mt-1 font-medium text-orange-300">{row.sellRealm}</p>
                        <p className="text-xs text-zinc-500">{row.targetSell}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">Why it ranks: {row.why}</p>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-white/10 bg-zinc-950/80 md:block">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr_0.9fr_0.9fr] gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    <span>Opportunity</span>
                    <span>Buy</span>
                    <span>Sell</span>
                    <span>Target</span>
                    <span className="text-center">Profit / ROI</span>
                    <span className="text-center">Confidence</span>
                    <span className="text-center">Sellability</span>
                  </div>
                  {previewRows.map((row, index) => (
                    <div key={row.item} className="border-b border-white/10 px-3 py-2.5 last:border-b-0">
                      <div className="grid grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr_0.9fr_0.9fr] items-center gap-2 text-sm">
                        <div className="pr-2">
                          <p className="truncate font-semibold text-zinc-100">{row.item}</p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <Badge tone="neutral">{row.category}</Badge>
                            <Badge tone={index === 0 ? "success" : "warning"}>{index === 0 ? "stable" : "tradable"}</Badge>
                          </div>
                        </div>
                        <span className="text-zinc-400">{row.buyRealm}<span className="block text-xs text-zinc-500">{row.buyPrice}</span></span>
                        <span className="font-medium text-orange-300">{row.sellRealm}</span>
                        <span className="text-zinc-300">{row.targetSell}</span>
                        <span>
                          <span className="flex items-center gap-1"><GoldAmount value={row.profit} /></span>
                          <span className="ml-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">{row.roi}</span>
                        </span>
                        <div className="flex flex-col items-center gap-1">
                          <ScoreDial score={row.confidence} />
                          <span className="text-[10px] uppercase tracking-link opacity-0 select-none" aria-hidden="true">
                            label
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <ScoreDial score={row.sellability} />
                          <span className="text-[10px] uppercase tracking-link text-zinc-500">{row.turnoverLabel}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">Why it ranks: {row.why}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-400">
                <p>
                  Ranking signals based on spread quality, fee-adjusted ROI, confidence score, and configured risk filters.
                </p>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-2 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="inline-flex rounded-md border border-orange-400/35 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-orange-300">
                  {card.cue}
                </span>
                <h2 className="font-display text-[16px] font-semibold leading-tight text-zinc-100">{card.title}</h2>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-400">{card.description}</p>
            </article>
          ))}
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-4 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Guest settings stay in your browser. Signed-in presets and realms sync to your account.</p>
          <Link to="/privacy" className="font-semibold text-orange-300 transition hover:text-orange-200">
            Privacy Policy
          </Link>
        </footer>
      </main>
    </div>
  );
}
