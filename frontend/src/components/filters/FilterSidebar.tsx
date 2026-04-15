import type { ScannerFilters } from "../../types/models";

interface FilterSidebarProps {
  filters: ScannerFilters;
  onChange: (next: Partial<ScannerFilters>) => void;
  categoryOptions: string[];
}

export const DEFAULT_CATEGORY_OPTIONS = ["Armor", "Weapon", "Recipe", "Consumable", "Trade Good", "Container", "Gem", "Glyph", "Miscellaneous"];

export function FilterSidebar({ filters, onChange, categoryOptions }: FilterSidebarProps) {
  const categories = Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...categoryOptions])).sort((left, right) => left.localeCompare(right));

  return (
    <aside className="space-y-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-card xl:sticky xl:top-6 xl:self-start">
      <h2 className="font-display text-lg font-semibold text-ink">Filters</h2>
      <label className="block text-sm text-slate-700">
        Min profit
        <input
          id="scanner-filter-min-profit"
          name="minProfit"
          value={filters.minProfit}
          onChange={(event) => onChange({ minProfit: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="2500"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Min ROI
        <input
          id="scanner-filter-min-roi"
          name="minRoi"
          value={filters.minRoi}
          onChange={(event) => onChange({ minRoi: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="0.15"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Max buy price
        <input
          id="scanner-filter-max-buy-price"
          name="maxBuyPrice"
          value={filters.maxBuyPrice}
          onChange={(event) => onChange({ maxBuyPrice: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="50000"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Min confidence
        <input
          id="scanner-filter-min-confidence"
          name="minConfidence"
          value={filters.minConfidence}
          onChange={(event) => onChange({ minConfidence: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          placeholder="60"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Category
        <select
          id="scanner-filter-category"
          name="category"
          value={filters.category}
          onChange={(event) => onChange({ category: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-700">
        Sort by
        <select
          id="scanner-filter-sort-by"
          name="sortBy"
          value={filters.sortBy}
          onChange={(event) => onChange({ sortBy: event.target.value as ScannerFilters["sortBy"] })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <option value="final_score">Final score</option>
          <option value="estimated_profit">Profit</option>
          <option value="cheapest_buy_price">Buy price</option>
          <option value="roi">ROI</option>
          <option value="confidence_score">Confidence</option>
        </select>
      </label>
      <label className="block text-sm text-slate-700">
        Sort direction
        <select
          id="scanner-filter-sort-direction"
          name="sortDirection"
          value={filters.sortDirection}
          onChange={(event) => onChange({ sortDirection: event.target.value as ScannerFilters["sortDirection"] })}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <option value="desc">Highest to lowest</option>
          <option value="asc">Lowest to highest</option>
        </select>
      </label>
      <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Hide risky flips
        <input id="scanner-filter-hide-risky" name="hideRisky" type="checkbox" checked={filters.hideRisky} onChange={(event) => onChange({ hideRisky: event.target.checked })} />
      </label>
    </aside>
  );
}
