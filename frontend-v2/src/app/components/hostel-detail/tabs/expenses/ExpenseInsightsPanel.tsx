import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react';

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  category: TrendingUp,
  salary: Users,
  anomaly: AlertTriangle,
  profit: TrendingDown,
  leakage: Copy,
  growth: TrendingUp,
  healthy: CheckCircle2,
};

export function ExpenseInsightsPanel({
  insights,
  onFilterCategory,
}: {
  insights: Record<string, any>[];
  onFilterCategory?: (category: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <h2 className="text-base font-semibold text-foreground">Expense insights</h2>
          <p className="text-xs text-muted-foreground">Collapsed by default so daily entry stays fast</p>
        </div>
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          {insights.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Insights appear after a few expenses are recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {insights.slice(0, 6).map((insight, i) => {
                const Icon = TYPE_ICON[insight.type] || Sparkles;
                const category = extractCategoryFromInsight(insight);
                return (
                  <div
                    key={`${insight.title}-${i}`}
                    role={category && onFilterCategory ? 'button' : undefined}
                    tabIndex={category && onFilterCategory ? 0 : undefined}
                    onClick={category && onFilterCategory ? () => onFilterCategory(category) : undefined}
                    className={`flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 ${
                      category && onFilterCategory ? 'cursor-pointer hover:border-accent/40' : ''
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${severityColor(insight.severity)}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function severityColor(severity: string) {
  if (severity === 'dangerous') return 'text-destructive';
  if (severity === 'warning') return 'text-warning';
  return 'text-success';
}

function extractCategoryFromInsight(insight: Record<string, any>): string | null {
  // Insight titles are generated server-side as "<Category> ..." for category-shaped
  // insights (category/anomaly/growth types) — best-effort match, not exact parsing.
  if (!['category', 'anomaly', 'growth'].includes(insight.type)) return null;
  const match = String(insight.title || '').match(/^(.+?) (consumed|is trending|is the fastest)/);
  return match ? match[1] : null;
}
