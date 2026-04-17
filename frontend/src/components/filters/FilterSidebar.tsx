import { Input } from "../common/Input";
import { Select } from "../common/Select";
import { Checkbox } from "../common/Checkbox";
import { Button } from "../common/Button";
import type { ScannerFilters } from "../../types/models";
import { getCategoryLabel, type ItemCategoryGroup } from "../../utils/itemCategories";

interface FilterSidebarProps {
  filters: ScannerFilters;
  onChange: (next: Partial<ScannerFilters>) => void;
  categoryOptions: string[];
  categoryGroups?: ItemCategoryGroup[];
  realmOptions: string[];
  onReset?: () => void;
}

export const DEFAULT_CATEGORY_OPTIONS = [
  "Armor",
  "Weapon",
  "Battle Pets",
  "Recipe",
  "Consumable",
  "Trade Good",
  "Container",
  "Gem",
  "Glyph",
  "Miscellaneous",
];

export function FilterSidebar({ filters, onChange, categoryOptions, categoryGroups, realmOptions, onReset }: FilterSidebarProps) {
  const categories = categoryGroups?.length
    ? categoryGroups
    : Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...categoryOptions]))
      .sort((left, right) => left.localeCompare(right))
      .map((category) => ({ value: category, label: getCategoryLabel(category), subcategories: [] }));
  const selectedCategory = categories.find((category) => category.value.toLowerCase() === filters.category.toLowerCase());
  const subcategories = selectedCategory?.subcategories ?? [];

  return (
    <aside className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-md backdrop-blur-xl xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-zinc-100 uppercase tracking-wider">Filters</h2>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Profitability Section */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Profitability</h3>
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
      <div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Risk</h3>
        <Input
          id="scanner-filter-max-buy-price"
          name="maxBuyPrice"
          type="number"
          value={filters.maxBuyPrice}
          onChange={(event) => onChange({ maxBuyPrice: event.target.value })}
          placeholder="Max buy price"
          isCompact
        />
      </div>

      {/* Confidence & Category Section */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Discovery</h3>
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
          onChange={(event) => onChange({ category: event.target.value, subcategory: "" })}
          isCompact
        >
          <option value="">All main categories</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
        <Select
          id="scanner-filter-subcategory"
          name="subcategory"
          value={filters.subcategory}
          onChange={(event) => onChange({ subcategory: event.target.value })}
          disabled={!filters.category}
          isCompact
        >
          <option value="">{filters.category ? `All ${selectedCategory?.label ?? filters.category}` : "Pick a main category first"}</option>
          {subcategories.map((subcategory) => (
            <option key={subcategory.value} value={subcategory.value}>
              {subcategory.label}
            </option>
          ))}
        </Select>
        <Input
          id="scanner-filter-min-spread"
          label="Minimum price gap"
          name="minSpread"
          type="number"
          value={filters.minSpread}
          onChange={(event) => onChange({ minSpread: event.target.value })}
          placeholder="0.20 means 20% higher"
          hint="Only show flips where the sell price is at least this much above the buy price."
          isCompact
        />
        <Input
          id="scanner-filter-max-spread"
          label="Maximum price gap"
          name="maxSpread"
          type="number"
          value={filters.maxSpread}
          onChange={(event) => onChange({ maxSpread: event.target.value })}
          placeholder="2.00 means 200% higher"
          hint="Hide extreme gaps that may be inflated, thin, or less realistic."
          isCompact
        />
        <Select
          id="scanner-filter-buy-realm"
          name="buyRealm"
          value={filters.buyRealm}
          onChange={(event) => onChange({ buyRealm: event.target.value })}
          isCompact
        >
          <option value="">All buy realms</option>
          {realmOptions.map((realm) => (
            <option key={`buy-${realm}`} value={realm}>
              {realm}
            </option>
          ))}
        </Select>
        <Select
          id="scanner-filter-sell-realm"
          name="sellRealm"
          value={filters.sellRealm}
          onChange={(event) => onChange({ sellRealm: event.target.value })}
          isCompact
        >
          <option value="">All sell realms</option>
          {realmOptions.map((realm) => (
            <option key={`sell-${realm}`} value={realm}>
              {realm}
            </option>
          ))}
        </Select>
      </div>

      {/* Sorting Section */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Sorting</h3>
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
          <option value="spread_percent">Spread %</option>
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

      <div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Safety</h3>
        <Checkbox
          id="scanner-filter-hide-risky"
          name="hideRisky"
          checked={filters.hideRisky}
          onChange={(event) => onChange({ hideRisky: event.target.checked })}
          label="Hide risky flips"
          compact
        />
      </div>
    </aside>
  );
}
