import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { PublicHeader } from "../components/layout/PublicHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PublicDocs() {
  useDocumentTitle("/HowItWorks", {
    title: "How It Works - Azeroth Flip",
    description: "Learn how Azeroth Flip helps compare realms, rank opportunities, and make more informed World of Warcraft auction house decisions.",
  });

  const workflow = [
    {
      title: "Choose your market route",
      description: "Start by selecting the realms you want to buy from and the realms you want to sell on. You can keep this broad for discovery or narrow it down when you already know where you like to trade.",
    },
    {
      title: "Scan matching items",
      description: "Azeroth Flip compares the same item across your chosen realms so you can see where it appears cheaper and where the sell-side market looks stronger.",
    },
    {
      title: "Account for practical costs",
      description: "The app focuses on estimated net opportunity, not just the raw price gap. It weighs buy price, target sell price, expected fees, and the amount of gold tied up in the flip.",
    },
    {
      title: "Rank the cleaner opportunities",
      description: "Results are ordered around useful trading signals like profit, ROI, confidence, sellability, realm spread, and visible market risk.",
    },
    {
      title: "Filter to match your style",
      description: "Use filters and presets to hide flips that are too small, too slow, too risky, or below your preferred confidence level.",
    },
    {
      title: "Review before you buy",
      description: "Use the item details and ranking notes as a decision aid. Markets move quickly, so the final purchase and posting choice should still be checked in game.",
    },
  ];

  const resultFields = [
    {
      field: "Profit",
      meaning: "The estimated gold left after buying and selling costs. This helps you compare absolute upside across items.",
    },
    {
      field: "ROI",
      meaning: "Profit compared with the buy price. A high ROI can be useful when you want your gold working efficiently instead of sitting in expensive inventory.",
    },
    {
      field: "Confidence",
      meaning: "A plain-language reliability score for the opportunity. It favors fresher, steadier, better-supported market situations.",
    },
    {
      field: "Sellability",
      meaning: "An estimate of how comfortable the sell-side market looks. It helps separate a large price gap from an opportunity that may actually move.",
    },
    {
      field: "Spread",
      meaning: "The difference between the source price and the target sell price. Bigger spreads can be attractive, but they still need healthy market context.",
    },
    {
      field: "Risk",
      meaning: "A warning signal for markets that look thin, jumpy, crowded, or otherwise less dependable. Risk does not always mean avoid, but it does mean slow down.",
    },
  ];

  const baseCalculation = [
    {
      title: "1. Start with the buy price",
      description: "The scanner looks at the cheapest usable source price for the item on the buy realm. This is the gold you would need to commit before the flip can happen.",
    },
    {
      title: "2. Choose a realistic sell target",
      description: "The sell target is based on the destination market, but it is kept grounded by current listings and supporting market context. The goal is to avoid treating one strange listing as a dependable sale price.",
    },
    {
      title: "3. Subtract sale costs and buffer",
      description: "Estimated profit is based on the sell target after auction-house cut, minus the buy price, minus a small practical buffer. In plain terms: expected take-home gold minus what you spent.",
    },
    {
      title: "4. Convert profit into ROI",
      description: "ROI compares the estimated profit with the buy price. A 10,000g profit can be excellent on a 20,000g item and weak on a 500,000g item, so ROI helps show capital efficiency.",
    },
    {
      title: "5. Rank beyond raw profit",
      description: "The final rank blends profit, ROI, confidence, sellability, and capital efficiency. A massive spread can still rank lower if the market looks thin, stale, or hard to exit.",
    },
  ];

  const tuningDetails = [
    {
      title: "Confidence tuning",
      description: "Confidence rewards cleaner evidence: enough listings to compare, recent data, steadier price behavior, and fewer signs that the target price is a one-off spike.",
    },
    {
      title: "Sellability tuning",
      description: "Sellability looks at whether the destination market appears healthy enough to move the item. It weighs depth, stability, and anti-bait signals so slow or fragile markets do not look stronger than they are.",
    },
    {
      title: "Risk tuning",
      description: "Risk tuning lowers the rank when the scanner sees patterns that often make flips harder to execute, such as very thin sell-side inventory, stale market snapshots, inconsistent history, or unusually wide spreads.",
    },
    {
      title: "Capital tuning",
      description: "Capital tuning helps avoid over-favoring expensive items with modest returns. The scanner can prefer a cleaner, more efficient flip over a larger-looking flip that locks up too much gold for the expected return.",
    },
  ];

  const safeguards = [
    {
      title: "Evidence caps",
      description: "If an opportunity does not have enough sell-side depth, history, or recent data, its score is capped. This keeps weak-evidence flips from appearing as top-tier just because the visible spread is large.",
    },
    {
      title: "Stale data penalties",
      description: "When market context is older or has freshness gaps, confidence is reduced. Auction-house prices can move quickly, so older evidence should not carry the same trust as recent evidence.",
    },
    {
      title: "Spike and bait protection",
      description: "The scanner watches for sell prices that sit far above recent behavior or look unusually stretched compared with the rest of the market. These can be profitable, but they can also be bait listings or short-lived spikes.",
    },
    {
      title: "Thin-market protection",
      description: "Items with very few listings or sellers can be difficult to buy or resell at the expected price. Thin markets get reduced confidence so they are treated as speculative instead of automatic wins.",
    },
    {
      title: "Regional value anchoring",
      description: "For rare or unusual items, the scanner uses broader market context to keep sell targets from drifting too far above what the item has historically supported.",
    },
    {
      title: "Risk labels and filters",
      description: "Risky opportunities are flagged so you can hide them or review them more carefully. The safeguard is there to slow down decisions when the numbers look tempting but the market evidence is weaker.",
    },
  ];

  const tools = [
    {
      title: "Realm lists",
      description: "Save the realms you care about so each scan starts with the markets that match your trading route.",
    },
    {
      title: "Scanner filters",
      description: "Set minimum profit, ROI, confidence, and other thresholds so the table stays focused on trades you would actually consider.",
    },
    {
      title: "Presets",
      description: "Keep different scanning styles ready, such as a conservative preset for steady items and a wider preset for discovery.",
    },
    {
      title: "Item context",
      description: "Open an item to inspect supporting details before committing gold to the flip.",
    },
  ];

  const goodUse = [
    "Compare possible routes before spending gold.",
    "Shortlist items that deserve a closer in-game check.",
    "Avoid opportunities that only look good because one number is unusually high or low.",
    "Keep your scanner setup consistent across repeat sessions.",
  ];

  const limits = [
    "Auction house prices can change faster than any scanner can guarantee.",
    "A high score is not a promise that an item will sell at the target price.",
    "Very thin markets can look profitable while still being difficult to exit.",
    "Use the app as a decision tool, then confirm current listings before buying.",
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <PublicHeader subtitle="How it works" secondaryCtaLabel="Home" secondaryCtaTo="/home" />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card
          variant="elevated"
          title="How Azeroth Flip works"
          subtitle="A user-friendly guide to scanning, filtering, and reading cross-realm opportunities."
        >
          <div className="space-y-3 text-sm leading-6 text-zinc-300">
            <p>
              Azeroth Flip is built to answer one practical question: where might an item be worth buying, and where might it be worth selling? It brings realm pricing, item context, and your own filters into one scanner so you can compare opportunities without bouncing between spreadsheets.
            </p>
            <p>
              The app does not make the trade for you, and it does not guarantee a sale. It gives you a ranked, easier-to-read shortlist so you can spend your time checking the best candidates.
            </p>
          </div>
        </Card>

        <Card title="The scanner flow" subtitle="From realm setup to a shortlist of trades.">
          <div className="grid gap-3 md:grid-cols-2">
            {workflow.map((item, index) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-400/35 bg-orange-500/10 text-xs font-semibold text-orange-300">
                    {index + 1}
                  </span>
                  <p className="font-medium text-zinc-100">{item.title}</p>
                </div>
                <p className="text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="How to read a result" subtitle="The important columns in plain English.">
          <div className="space-y-3">
            {resultFields.map((item) => (
              <div key={item.field} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.field}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{item.meaning}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="How the calculation works" subtitle="The base math behind a ranked opportunity.">
          <div className="space-y-3">
            {baseCalculation.map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-orange-400/25 bg-orange-500/10 px-3 py-3 text-sm leading-6 text-orange-100">
            <p className="font-medium text-orange-200">Simple version</p>
            <p className="mt-1">
              Estimated profit is the likely sell value after normal auction costs, minus the buy cost and a safety buffer. ROI is that estimated profit compared with the buy cost. The final rank then adjusts that raw opportunity by how trustworthy and sellable the market looks.
            </p>
          </div>
        </Card>

        <Card title="How tuning changes the score" subtitle="Tuning does not replace the base math; it changes how much trust the scanner gives the opportunity.">
          <div className="grid gap-3 md:grid-cols-2">
            {tuningDetails.map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Safeguards and why they exist" subtitle="The scanner is intentionally cautious when a flip looks good for the wrong reason.">
          <div className="grid gap-3 md:grid-cols-2">
            {safeguards.map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Filters, presets, and item context" subtitle="The controls are there to make the scanner match how you trade.">
          <div className="grid gap-3 md:grid-cols-2">
            {tools.map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="What it is good for">
            <ul className="space-y-2 text-sm leading-6 text-zinc-300">
              {goodUse.map((entry) => (
                <li key={entry} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  {entry}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="What to keep in mind">
            <ul className="space-y-2 text-sm leading-6 text-zinc-300">
              {limits.map((entry) => (
                <li key={entry} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  {entry}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Privacy and trust" variant="flat">
          <div className="space-y-3 text-sm leading-6 text-zinc-300">
            <p>
              Public pages explain the product at a high level. Your saved realms, presets, account settings, and scanner activity are treated as private app data and are not displayed on public pages.
            </p>
            <p>
              Guest settings stay in your browser. Signing in is mainly for syncing your setup across devices and keeping saved preferences attached to your account.
            </p>
            <Link to="/privacy" className="inline-flex font-semibold text-orange-300 transition hover:text-orange-200">
              Read the Privacy Policy
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
