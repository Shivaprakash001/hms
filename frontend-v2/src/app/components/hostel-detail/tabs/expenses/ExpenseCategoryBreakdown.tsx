import { categoryIcon, categoryTone } from '@features/expenses/constants';
import { fmtExact } from '../../shared/format';

export function ExpenseCategoryBreakdown({
  categories,
  onFilterCategory,
}: {
  categories: Record<string, any>[];
  onFilterCategory?: (category: string) => void;
}) {
  const maxCategory = Math.max(...categories.map((c) => Number(c.amount || 0)), 1);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Monthly expense breakdown</h2>
        <p className="text-xs text-muted-foreground">What is consuming business cash this month</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        {categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Add expenses to see where the business is spending money.
          </p>
        ) : (
          <div className="space-y-3">
            {categories.slice(0, 8).map((cat) => (
              <button
                key={String(cat.category)}
                type="button"
                onClick={onFilterCategory ? () => onFilterCategory(cat.category) : undefined}
                className={`w-full text-left ${onFilterCategory ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                  <span className="font-semibold text-foreground">
                    {categoryIcon(String(cat.category))} {cat.category}
                  </span>
                  <span className="font-bold text-foreground">{fmtExact(cat.amount)}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${categoryTone(cat.category).bar}`}
                    style={{ width: `${Math.max(4, (Number(cat.amount || 0) / maxCategory) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{Number(cat.percentage || 0).toFixed(0)}% of expenses</span>
                  {cat.anomaly && <span className="font-semibold text-warning">{cat.anomaly}</span>}
                </div>
              </button>
            ))}
            <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">Total</span>
              <span className="text-lg font-bold text-foreground">
                {fmtExact(categories.reduce((sum, cat) => sum + Number(cat.amount || 0), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
