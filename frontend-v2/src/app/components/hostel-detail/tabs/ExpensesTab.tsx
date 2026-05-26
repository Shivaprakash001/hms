import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CalendarDays, Repeat2, Zap, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { fmt } from '../shared/format';
import { TabError, TabSkeleton } from '../shared/TabStates';
import { IdleRender } from '@/shared/performance';

const AddExpenseModal = lazy(() => import('./expenses/AddExpenseModal').then((m) => ({ default: m.AddExpenseModal }))); 

export function ExpensesTab({ hostelId }: { hostelId: string }) {
  const queryClient = useQueryClient();
  const ledgerScrollRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState('month');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const params = useMemo(
    () => ({
      range,
      status,
      sort,
      search,
      categories: selectedCategories.join(','),
      limit: 40,
    }),
    [range, search, selectedCategories, sort, status],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.list(hostelId), params],
    queryFn: () =>
      import('@features/expenses/api').then((m) => m.expenseService.getAll(hostelId, params)),
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(hostelId, body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      setShowAddExpense(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      import('@features/expenses/api').then((m) => m.expenseService.update(id, body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => import('@features/expenses/api').then((m) => m.expenseService.delete(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) }),
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const payload = (data || {}) as Record<string, any>;
  const expenses: Record<string, any>[] = Array.isArray(payload.expenses) ? payload.expenses : [];
  const kpis = payload.kpis || {};
  const categories = Array.isArray(payload.category_breakdown) ? payload.category_breakdown : [];
  const insights = Array.isArray(payload.insights) ? payload.insights : [];
  const monthlyTrend = Array.isArray(payload.monthly_trend) ? payload.monthly_trend : [];
  const occupancy = payload.occupancy_impact || {};
  const allCategories: string[] = payload.meta?.categories || EXPENSE_CATEGORIES;
  const maxCategory = useMemo(
    () => Math.max(...categories.map((c: any) => Number(c.amount || 0)), 1),
    [categories],
  );
  const maxTrend = useMemo(
    () => Math.max(
      ...monthlyTrend.map((m: any) => Math.max(Number(m.revenue || 0), Number(m.expenses || 0), Number(m.profit || 0))),
      1,
    ),
    [monthlyTrend],
  );
  const expenseVirtualizer = useVirtualizer({
    count: expenses.length,
    getScrollElement: () => ledgerScrollRef.current,
    estimateSize: () => 132,
    overscan: 6,
  });

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  };

  return (
    <div className="relative space-y-5 pb-24">
      <div className="sticky top-[92px] z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <ExpenseKpi
            label="This Month Expenses"
            value={fmt(kpis.this_month_expenses)}
            sub={`${Math.abs(Number(kpis.expense_growth_rate || 0)).toFixed(0)}% ${Number(kpis.expense_growth_rate || 0) >= 0 ? 'vs last month' : 'lower'}`}
            state={Number(kpis.expense_growth_rate || 0) > 20 ? 'dangerous' : Number(kpis.expense_growth_rate || 0) > 5 ? 'warning' : 'healthy'}
            trend={Number(kpis.expense_growth_rate || 0)}
          />
          <ExpenseKpi
            label="Net Profit"
            value={fmt(kpis.net_profit)}
            sub={`${Number(kpis.profit_margin || 0).toFixed(0)}% margin`}
            state={String(kpis.health || 'healthy')}
          />
          <ExpenseKpi
            label="Expense / Tenant"
            value={fmt(kpis.expense_per_tenant)}
            sub="operational load"
            state={Number(kpis.expense_per_tenant || 0) > 10000 ? 'warning' : 'healthy'}
          />
          <ExpenseKpi
            label="Expense Ratio"
            value={`${Number(kpis.expense_revenue_ratio || 0).toFixed(0)}%`}
            sub="of revenue consumed"
            state={String(kpis.expense_ratio_health || 'healthy')}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddExpense(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground active:scale-[0.99] transition-transform"
        >
          <Plus className="h-4 w-4" />
          Add expense
        </button>
      </div>

      <section className="space-y-3">
        <SectionTitle
          title="Expense Ledger"
          sub={`${payload.total || expenses.length} records`}
          actionLabel="Add expense"
          onAction={() => setShowAddExpense(true)}
        />
        <div className="sticky top-[260px] z-[9] -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-y border-border space-y-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`shrink-0 px-3 py-2 rounded-full text-xs font-semibold border ${
                  range === value ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
              <option value="recent">Recent</option>
              <option value="highest">Highest Amount</option>
              <option value="oldest">Oldest</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, vendor, notes"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {allCategories.slice(0, 12).map((category) => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${
                  selectedCategories.includes(category)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {expenses.length === 0 ? (
          <ExpenseEmptyState onAdd={() => setShowAddExpense(true)} />
        ) : (
          <div ref={ledgerScrollRef} className="max-h-[640px] overflow-auto pr-1">
            <div className="relative" style={{ height: expenseVirtualizer.getTotalSize() }}>
              {expenseVirtualizer.getVirtualItems().map((virtualRow) => {
                const expense = expenses[virtualRow.index];
                return (
                  <div
                    key={String(expense.id)}
                    className="absolute left-0 right-0 pb-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <ExpenseCard
                      expense={expense}
                      onDuplicate={() => setShowAddExpense(true)}
                      onMarkPending={() => updateMutation.mutate({ id: String(expense.id), body: { status: 'pending' } })}
                      onDelete={() => deleteMutation.mutate(String(expense.id))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <IdleRender>
        <ExpenseIntelligence
          categories={categories}
          insights={insights}
          maxCategory={maxCategory}
          maxTrend={maxTrend}
          monthlyTrend={monthlyTrend}
          occupancy={occupancy}
          onAddExpense={() => setShowAddExpense(true)}
        />
      </IdleRender>

      {showAddExpense && (
        <Suspense fallback={null}>
          <AddExpenseModal
            categories={allCategories}
            loading={createMutation.isPending}
            onClose={() => setShowAddExpense(false)}
            onSubmit={(body) => createMutation.mutate(body)}
          />
        </Suspense>
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  'Food',
  'Electricity',
  'Water',
  'Internet',
  'Staff Salary',
  'Maintenance',
  'Repairs',
  'Cleaning',
  'Security',
  'Furniture',
  'Kitchen',
  'Marketing',
  'Transport',
  'Miscellaneous',
];

function ExpenseIntelligence({
  categories,
  insights,
  maxCategory,
  maxTrend,
  monthlyTrend,
  occupancy,
  onAddExpense,
}: {
  categories: Record<string, any>[];
  insights: Record<string, any>[];
  maxCategory: number;
  maxTrend: number;
  monthlyTrend: Record<string, any>[];
  occupancy: Record<string, any>;
  onAddExpense: () => void;
}) {
  return (
    <section className="space-y-3">
      <SectionTitle
        title="Expense Intelligence"
        sub="Where money is moving and what needs attention"
        actionLabel="Add expense"
        onAction={onAddExpense}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Category Breakdown</h3>
            <span className="text-[10px] text-muted-foreground">This month</span>
          </div>
          {categories.length === 0 ? (
            <EmptyMini
              text="Add your first expense to reveal category leakage."
              actionLabel="Add expense"
              onAction={onAddExpense}
            />
          ) : (
            <div className="space-y-3">
              {categories.slice(0, 8).map((cat) => (
                <div key={String(cat.category)}>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                    <span className="font-medium text-foreground">{cat.category}</span>
                    <span className="text-muted-foreground">
                      {fmt(cat.amount)} · {Number(cat.percentage || 0).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${categoryTone(cat.category).bar}`}
                      style={{ width: `${Math.max(4, (Number(cat.amount || 0) / maxCategory) * 100)}%` }}
                    />
                  </div>
                  {cat.anomaly && <div className="mt-1 text-[10px] font-medium text-warning">{cat.anomaly}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Health Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={`${insight.title}-${i}`} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full ${severityDot(insight.severity)}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue · Expense · Profit</h3>
          <div className="space-y-3">
            {monthlyTrend.map((m) => (
              <div key={String(m.month)} className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{String(m.month)}</span>
                  <span>{fmt(m.profit)} profit</span>
                </div>
                <div className="grid grid-cols-3 gap-1 h-8 items-end">
                  <TrendBar value={Number(m.revenue || 0)} max={maxTrend} className="bg-success" />
                  <TrendBar value={Number(m.expenses || 0)} max={maxTrend} className="bg-destructive" />
                  <TrendBar value={Math.max(0, Number(m.profit || 0))} max={maxTrend} className="bg-accent" />
                </div>
              </div>
            ))}
            <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1">
                <i className="w-2 h-2 rounded-full bg-success" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="w-2 h-2 rounded-full bg-destructive" />
                Expenses
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="w-2 h-2 rounded-full bg-accent" />
                Profit
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Occupancy Impact</h3>
          <div className="grid grid-cols-2 gap-3">
            <ImpactMetric label="Occupancy" value={`${Number(occupancy.occupancy_rate || 0).toFixed(0)}%`} />
            <ImpactMetric label="Expense / Bed" value={fmt(occupancy.expense_per_occupied_bed)} />
            <ImpactMetric label="Vacancy Loss" value={fmt(occupancy.vacancy_loss_estimate)} />
            <ImpactMetric label="Fixed Cost" value={`${Number(occupancy.fixed_cost_pressure || 0).toFixed(0)}%`} />
          </div>
          <div className="mt-4 rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-foreground">
            {occupancy.message || 'Occupancy and cost pressure will appear as snapshots build.'}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({
  title,
  sub,
  actionLabel,
  onAction,
}: {
  title: string;
  sub?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ExpenseKpi({ label, value, sub, state, trend }: { label: string; value: string; sub: string; state: string; trend?: number }) {
  const color = state === 'dangerous' ? 'text-destructive' : state === 'warning' ? 'text-warning' : 'text-success';
  return (
    <div className="bg-card border border-border rounded-xl p-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{label}</p>
        {trend !== undefined ? (
          trend >= 0 ? <TrendingUp className={`w-3.5 h-3.5 ${color}`} /> : <TrendingDown className="w-3.5 h-3.5 text-success" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${state === 'dangerous' ? 'bg-destructive' : state === 'warning' ? 'bg-warning' : 'bg-success'}`} />
        )}
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function categoryTone(category: string) {
  const tones: Record<string, { chip: string; bar: string }> = {
    Food: { chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
    Electricity: { chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
    Water: { chip: 'bg-info/10 text-info', bar: 'bg-info' },
    Internet: { chip: 'bg-accent/10 text-accent', bar: 'bg-accent' },
    Maintenance: { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  };
  return tones[category] || { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' };
}

function severityDot(severity: string) {
  if (severity === 'dangerous') return 'bg-destructive';
  if (severity === 'warning') return 'bg-warning';
  return 'bg-success';
}

function TrendBar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-8 flex items-end rounded bg-muted/40 overflow-hidden">
      <div className={`w-full rounded-t ${className}`} style={{ height: `${Math.max(5, (value / max) * 100)}%` }} />
    </div>
  );
}

function ImpactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyMini({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p>{text}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ExpenseEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
        <Zap className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-foreground">Start tracking hostel operations</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Track electricity, food, maintenance and staff costs to understand profitability.
      </p>
      <div className="mt-4 grid gap-2 text-left text-xs text-muted-foreground">
        <div className="rounded-lg bg-background border border-border p-3">Food cost vs revenue insight</div>
        <div className="rounded-lg bg-background border border-border p-3">Expense per occupied bed</div>
        <div className="rounded-lg bg-background border border-border p-3">Profit margin warnings</div>
      </div>
      <button onClick={onAdd} className="mt-5 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold">
        Add First Expense
      </button>
    </div>
  );
}

function ExpenseCard({
  expense,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{String(expense.title || 'Expense')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${tone.chip}`}>{String(expense.category || 'Misc')}</span>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {expense.date ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No date'}
            </span>
            {expense.is_recurring && (
              <span className="text-[10px] text-accent inline-flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                Recurring
              </span>
            )}
          </div>
          {(expense.notes || expense.vendor_name || expense.hostel) && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {[expense.vendor_name, expense.notes, expense.hostel].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-foreground">{fmt(expense.amount)}</p>
          <p className={`mt-1 text-[10px] font-semibold ${expense.status === 'paid' ? 'text-success' : expense.status === 'cancelled' ? 'text-destructive' : 'text-warning'}`}>
            {String(expense.status || 'paid').toUpperCase()}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button onClick={onDuplicate} className="rounded-lg border border-border py-2 text-[10px] font-semibold text-muted-foreground">Duplicate</button>
        <button onClick={onMarkPending} className="rounded-lg border border-border py-2 text-[10px] font-semibold text-muted-foreground">Mark Pending</button>
        <button onClick={onDelete} className="rounded-lg border border-destructive/20 py-2 text-[10px] font-semibold text-destructive">Delete</button>
      </div>
    </div>
  );
}
