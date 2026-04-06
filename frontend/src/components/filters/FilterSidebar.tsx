import type { ScannerFilters } from "../../types/models";

interface FilterSidebarProps {
  filters: ScannerFilters;
  onChange: (next: Partial<ScannerFilters>) => void;
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  return (
    <aside className="space-y-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card xl:sticky xl:top-6 xl:self-start">
      <h2 className="font-display text-lg font-semibold text-ink">Filters</h2>
      <label className="block text-sm text-slate-700">
        Min profit
        <input
          value={filters.minProfit}
          onChange={(event) => onChange({ minProfit: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="2500"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Min ROI
        <input
          value={filters.minRoi}
          onChange={(event) => onChange({ minRoi: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="0.15"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Max buy price
        <input
          value={filters.maxBuyPrice}
          onChange={(event) => onChange({ maxBuyPrice: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="50000"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Min confidence
        <input
          value={filters.minConfidence}
          onChange={(event) => onChange({ minConfidence: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="60"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Category
        <input
          value={filters.category}
          onChange={(event) => onChange({ category: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="Weapon"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Sort by
        <select
          value={filters.sortBy}
          onChange={(event) => onChange({ sortBy: event.target.value as ScannerFilters["sortBy"] })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <option value="final_score">Final score</option>
          <option value="estimated_profit">Profit</option>
          <option value="roi">ROI</option>
          <option value="confidence_score">Confidence</option>
        </select>
      </label>
      <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Include stale data
        <input type="checkbox" checked={filters.allowStale} onChange={(event) => onChange({ allowStale: event.target.checked })} />
      </label>
      <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Hide risky flips
        <input type="checkbox" checked={filters.hideRisky} onChange={(event) => onChange({ hideRisky: event.target.checked })} />
      </label>
    </aside>
  );
}
