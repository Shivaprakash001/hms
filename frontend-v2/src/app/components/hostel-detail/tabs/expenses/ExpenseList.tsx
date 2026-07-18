import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Zap } from 'lucide-react';
import { fmtExact } from '../../shared/format';
import { ExpenseCard } from './ExpenseCard';

export const ExpenseList = memo(function ExpenseList({
  expenses,
  total,
  searchTerm,
  hasActiveFilters,
  onClearFilters,
  selectedIds,
  onToggleSelect,
  onSelectAllVisible,
  onClearSelection,
  onSelectExpense,
  onEditExpense,
  onDuplicateExpense,
  onMarkPending,
  onDelete,
}: {
  expenses: Record<string, any>[];
  total: number;
  searchTerm: string;
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAllVisible?: () => void;
  onClearSelection?: () => void;
  onSelectExpense: (expense: Record<string, any>) => void;
  onEditExpense: (expense: Record<string, any>) => void;
  onDuplicateExpense: (expense: Record<string, any>) => void;
  onMarkPending: (expense: Record<string, any>) => void;
  onDelete: (id: string) => void;
}) {
  const trimmedSearch = searchTerm.trim();
  const { data: titleSummary } = useQuery({
    queryKey: ['expenses', 'title_summary', trimmedSearch],
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getTitleSummary(trimmedSearch)),
    enabled: trimmedSearch.length >= 3 && !/\d{4,}/.test(trimmedSearch),
    staleTime: 3 * 60 * 1000,
  });

  const subtitle = trimmedSearch
    ? `${expenses.length} matching${total > expenses.length ? ` of ${total}` : ''}`
    : `${total} entries`;

  const summary = titleSummary?.summary;

  const selectedCount = selectedIds?.size || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recent expenses</h2>
          <p className="text-xs text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} selected` : subtitle}
          </p>
        </div>
        {onToggleSelect && expenses.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
            {selectedCount > 0 ? (
              <button type="button" onClick={onClearSelection} className="text-muted-foreground hover:text-foreground">
                Clear selection
              </button>
            ) : (
              <button type="button" onClick={onSelectAllVisible} className="text-accent hover:underline">
                Select all visible
              </button>
            )}
          </div>
        )}
      </div>

      {summary && trimmedSearch.length >= 3 && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">{titleSummary?.title} Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label="Transactions" value={String(summary.total_transactions)} />
            <MiniStat label="Total Spent" value={fmtExact(summary.total_spent)} />
            <MiniStat label="Avg / Month" value={fmtExact(summary.average_monthly)} />
            <MiniStat label="Highest" value={fmtExact(summary.highest)} />
            <MiniStat label="Lowest" value={fmtExact(summary.lowest)} />
            <MiniStat label="Months Tracked" value={String(summary.months_tracked)} />
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <ExpenseEmptyState hasActiveFilters={hasActiveFilters} onClearFilters={onClearFilters} />
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <ExpenseCard
              key={String(expense.id)}
              expense={expense}
              selected={selectedIds?.has(String(expense.id))}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(String(expense.id)) : undefined}
              onView={() => onSelectExpense(expense)}
              onEdit={() => onEditExpense(expense)}
              onDuplicate={() => onDuplicateExpense(expense)}
              onMarkPending={() => onMarkPending(expense)}
              onDelete={() => onDelete(String(expense.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function ExpenseEmptyState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
}) {
  if (hasActiveFilters) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <p className="text-sm font-semibold text-foreground">No expenses match these filters</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Try a broader date range, a different category, or clear filters to see everything.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
        <Zap className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-foreground">Start tracking business expenses</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Track food, salary, electricity, maintenance and supplier costs to understand profitability.
      </p>
      <div className="mt-4 grid gap-2 text-left text-xs text-muted-foreground">
        <div className="rounded-lg bg-background border border-border p-3">Category percentage of total expenses</div>
        <div className="rounded-lg bg-background border border-border p-3">Top vendors by payments</div>
        <div className="rounded-lg bg-background border border-border p-3">Profit margin warnings</div>
      </div>
    </div>
  );
}
