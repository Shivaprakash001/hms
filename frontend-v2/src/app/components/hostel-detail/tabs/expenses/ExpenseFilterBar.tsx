import { useEffect, useState } from 'react';
import { Bookmark, Search, SlidersHorizontal, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui';
import { categoryIcon, QUICK_PAYMENT_METHODS } from '@features/expenses/constants';
import { fmtExact } from '../../shared/format';

const PRESETS_STORAGE_KEY = 'hms:expense-filter-presets';

export type ExpenseFilterState = {
  range: string;
  customStart: string;
  customEnd: string;
  status: string;
  sort: string;
  searchTerm: string;
  selectedCategories: string[];
  vendor: string;
  paymentMethod: string;
  recurring: '' | 'true' | 'false';
  amountMin: string;
  amountMax: string;
};

type Preset = { name: string; filters: ExpenseFilterState };

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage unavailable — saved filters are a convenience, not required for correctness
  }
}

export function ExpenseFilterBar({
  filters,
  onChange,
  allCategories,
  categoryBreakdown,
  vendorOptions,
  trailingActions,
}: {
  filters: ExpenseFilterState;
  onChange: (next: Partial<ExpenseFilterState>) => void;
  allCategories: string[];
  categoryBreakdown: Record<string, any>[];
  vendorOptions: Record<string, any>[];
  trailingActions?: React.ReactNode;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const advancedActiveCount = [
    filters.status !== 'all',
    Boolean(filters.vendor),
    Boolean(filters.paymentMethod),
    filters.recurring !== '',
    Boolean(filters.amountMin),
    Boolean(filters.amountMax),
  ].filter(Boolean).length;

  const toggleCategory = (category: string) => {
    const next = filters.selectedCategories.includes(category)
      ? filters.selectedCategories.filter((c) => c !== category)
      : [...filters.selectedCategories, category];
    onChange({ selectedCategories: next });
  };

  const clearAdvanced = () => {
    onChange({ status: 'all', vendor: '', paymentMethod: '', recurring: '', amountMin: '', amountMax: '' });
  };

  const saveCurrentAsPreset = () => {
    const name = window.prompt('Name this filter view (e.g. "Overdue utilities")');
    if (!name?.trim()) return;
    const next = [...presets.filter((p) => p.name !== name.trim()), { name: name.trim(), filters }];
    setPresets(next);
    savePresets(next);
  };

  const applyPreset = (preset: Preset) => onChange(preset.filters);
  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    savePresets(next);
  };

  return (
    <div className="space-y-3">
      {/* Search + advanced filters trigger */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.searchTerm}
            onChange={(e) => onChange({ searchTerm: e.target.value })}
            placeholder="Search by title, vendor, category, payment method, amount..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-accent/20"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => onChange({ searchTerm: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`relative shrink-0 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                advancedActiveCount > 0 ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {advancedActiveCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                  {advancedActiveCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
              <select
                value={filters.status}
                onChange={(e) => onChange({ status: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort</p>
              <select
                value={filters.sort}
                onChange={(e) => onChange({ sort: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
              >
                <option value="recent">Recent</option>
                <option value="highest">Highest Amount</option>
                <option value="oldest">Oldest</option>
                <option value="category">Category</option>
              </select>
            </div>

            {vendorOptions.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor</p>
                <div className="flex flex-wrap gap-1.5">
                  {vendorOptions.slice(0, 8).map((v) => (
                    <button
                      key={String(v.vendor)}
                      type="button"
                      onClick={() => onChange({ vendor: filters.vendor === v.vendor ? '' : v.vendor })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        filters.vendor === v.vendor ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {v.vendor}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment method</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onChange({ paymentMethod: filters.paymentMethod === method ? '' : method })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      filters.paymentMethod === method ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recurring</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['', 'All'],
                  ['true', 'Recurring'],
                  ['false', 'One-time'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChange({ recurring: val as ExpenseFilterState['recurring'] })}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                      filters.recurring === val ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount range</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Min"
                  value={filters.amountMin}
                  onChange={(e) => onChange({ amountMin: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Max"
                  value={filters.amountMax}
                  onChange={(e) => onChange({ amountMax: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none"
                />
              </div>
            </div>

            {advancedActiveCount > 0 && (
              <button
                type="button"
                onClick={clearAdvanced}
                className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Clear these filters
              </button>
            )}
          </PopoverContent>
        </Popover>
        {trailingActions}
      </div>

      {/* Saved filter views */}
      {(presets.length > 0 || advancedActiveCount > 0 || filters.selectedCategories.length > 0) && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={saveCurrentAsPreset}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-accent/40 hover:text-accent"
          >
            <Bookmark className="h-3 w-3" /> Save view
          </button>
          {presets.map((preset) => (
            <span
              key={preset.name}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
            >
              <button type="button" onClick={() => applyPreset(preset)}>
                {preset.name}
              </button>
              <button type="button" onClick={() => deletePreset(preset.name)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Date quick filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          ['today', 'Today'],
          ['week', 'This Week'],
          ['month', 'This Month'],
          ['custom', 'Custom'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ range: value })}
            className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold ${
              filters.range === value ? 'border-accent bg-accent/10 text-accent' : 'bg-card border-border text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {filters.range === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.customStart}
            onChange={(e) => onChange({ customStart: e.target.value })}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
          />
          <input
            type="date"
            value={filters.customEnd}
            onChange={(e) => onChange({ customEnd: e.target.value })}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
          />
        </div>
      )}

      {/* Category chips */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {allCategories.map((category) => {
          const selected = filters.selectedCategories.includes(category);
          const stat = categoryBreakdown.find((item) => item.category === category);
          const amount = Number(stat?.amount || 0);
          const percentage = Number(stat?.percentage || 0);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className={`min-w-[138px] rounded-2xl border p-3 text-left ${
                selected ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-foreground'
              }`}
            >
              <span className="text-xl">{categoryIcon(category)}</span>
              <span className="mt-2 block text-sm font-bold leading-tight">{category}</span>
              <span className={`mt-1 block text-xs ${selected ? 'text-accent/80' : 'text-muted-foreground'}`}>
                {amount > 0 ? `${fmtExact(amount)} · ${percentage.toFixed(0)}%` : 'No spend'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
