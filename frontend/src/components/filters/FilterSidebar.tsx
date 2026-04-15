import { Input } from "../common/Input";
import { Select } from "../common/Select";
import { Checkbox } from "../common/Checkbox";
import { Button } from "../common/Button";
import type { ScannerFilters } from "../../types/models";

interface FilterSidebarProps {
  filters: ScannerFilters;
  onChange: (next: Partial<ScannerFilters>) => void;
  categoryOptions: string[];
  onReset?: () => void;
}

export const DEFAULT_CATEGORY_OPTIONS = ["Armor", "Weapon", "Recipe", "Consumable", "Trade Good", "Container", "Gem", "Glyph", "Miscellaneous"];

export function FilterSidebar({ filters, onChange, categoryOptions, onReset }: FilterSidebarProps) {
  const categories = Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...categoryOptions])).sort((left, right) => left.localeCompare(right));

  return (
    <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-md xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink uppercase tracking-wider">Filters</h2>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-slate-500 hover:text-slate-700 transition font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Profitability Section */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Profitability</h3>
        <Input
          id="scanner-filter-min-profit"
          name="minProfit"
          type="number"
          value={filters.minProfit}
          onChange={(event) => onChange({ minProfit: event.target.value })}
          placeholder="Min profit"
          isCompact
        />
        <Input
          id="scanner-filter-min-roi"
          name="minRoi"
          type="number"
          value={filters.minRoi}
          onChange={(event) => onChange({ minRoi: event.target.value })}
          placeholder="Min ROI %"
          isCompact
        />
      </div>

      {/* Risk Section */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Risk</h3>
        <Input
          id="scanner-filter-max-buy-price"
          name="maxBuyPrice"
          type="number"
          value={filters.maxBuyPrice}
          onChange={(event) => onChange({ maxBuyPrice: event.target.value })}
          placeholder="Max buy price"
          isCompact
        />
        <Checkbox
          id="scanner-filter-hide-risky"
          name="hideRisky"
          checked={filters.hideRisky}
          onChange={(event) => onChange({ hideRisky: event.target.checked })}
          label="Hide risky flips"
          compact
        />
      </div>

      {/* Confidence & Category Section */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Discovery</h3>
        <Input
          id="scanner-filter-min-confidence"
          name="minConfidence"
          type="number"
          value={filters.minConfidence}
          onChange={(event) => onChange({ minConfidence: event.target.value })}
          placeholder="Min confidence"
          isCompact
        />
        <Select
          id="scanner-filter-category"
          name="category"
          value={filters.category}
          onChange={(event) => onChange({ category: event.target.value })}
          isCompact
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </div>

      {/* Sorting Section */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Sorting</h3>
        <Select
          id="scanner-filter-sort-by"
          name="sortBy"
          value={filters.sortBy}
          onChange={(event) => onChange({ sortBy: event.target.value as ScannerFilters["sortBy"] })}
          isCompact
        >
          <option value="final_score">Final score</option>
          <option value="estimated_profit">Profit</option>
          <option value="cheapest_buy_price">Buy price</option>
          <option value="roi">ROI</option>
          <option value="confidence_score">Confidence</option>
        </Select>
        <Select
          id="scanner-filter-sort-direction"
          name="sortDirection"
          value={filters.sortDirection}
          onChange={(event) => onChange({ sortDirection: event.target.value as ScannerFilters["sortDirection"] })}
          isCompact
        >
          <option value="desc">Highest to lowest</option>
          <option value="asc">Lowest to highest</option>
        </Select>
      </div>
    </aside>
  );
}
