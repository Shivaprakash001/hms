import { lazy, Suspense, memo, useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Copy, Edit3, Eye, Paperclip, Plus, Repeat2, Search, Sparkles, Trash2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@lib/queryKeys';
import { fmt } from '../shared/format';
import { TabError, TabSkeleton } from '../shared/TabStates';
import { IdleRender } from '@/shared/performance';

const AddExpenseModal = lazy(() => import('./expenses/AddExpenseModal').then((m) => ({ default: m.AddExpenseModal }))); 

export function ExpensesTab({ hostelId }: { hostelId: string }) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState('month');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Record<string, any> | null>(null);
  const [draftExpense, setDraftExpense] = useState<Record<string, any> | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Record<string, any> | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const params = useMemo(
    () => ({
      range,
      startDate: range === 'custom' ? customStart : undefined,
      endDate: range === 'custom' ? customEnd : undefined,
      status,
      sort,
      categories: selectedCategories.join(','),
      limit: 40,
    }),
    [customEnd, customStart, range, selectedCategories, sort, status],
  );

  const targetHostelId = hostelId === 'all' ? undefined : hostelId;
  const queryHostelKey = hostelId || 'business';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.list(queryHostelKey), params],
    queryFn: () =>
      import('@features/expenses/api').then((m) => m.expenseService.getAll(targetHostelId, params)),
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(targetHostelId, body)),
    onSuccess: () => {
      toast.success('Expense added');
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(queryHostelKey) });
      if (hostelId !== 'all') {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('all') });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('business') });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      setShowAddExpense(false);
      setDraftExpense(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not add expense');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      import('@features/expenses/api').then((m) => m.expenseService.update(id, body)),
    onSuccess: () => {
      toast.success('Expense updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(queryHostelKey) });
      if (hostelId !== 'all') {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('all') });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('business') });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      setEditingExpense(null);
      setDraftExpense(null);
      setShowAddExpense(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not update expense');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => import('@features/expenses/api').then((m) => m.expenseService.delete(id)),
    onSuccess: () => {
      toast.success('Expense deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(queryHostelKey) });
      if (hostelId !== 'all') {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('all') });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('business') });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not delete expense');
    },
  });

  const payload = (data || {}) as Record<string, any>;
  const expenses: Record<string, any>[] = Array.isArray(payload.expenses) ? payload.expenses : [];
  const kpis = payload.kpis || {};
  const categories = Array.isArray(payload.category_breakdown) ? payload.category_breakdown : [];
  const insights = Array.isArray(payload.insights) ? payload.insights : [];
  const monthlyTrend = Array.isArray(payload.monthly_trend) ? payload.monthly_trend : [];
  const allCategories: string[] = payload.meta?.categories || EXPENSE_CATEGORIES;
  const topVendors = useMemo(() => getTopVendors(expenses), [expenses]);
  const latestMonth = monthlyTrend[monthlyTrend.length - 1] || {};
  const previousMonth = monthlyTrend[monthlyTrend.length - 2] || {};
  const momExpenseChange = getPercentChange(Number(latestMonth.expenses || 0), Number(previousMonth.expenses || 0));
  const maxCategory = useMemo(
    () => Math.max(...categories.map((c: any) => Number(c.amount || 0)), 1),
    [categories],
  );

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  };

  const openCreateExpense = () => {
    setEditingExpense(null);
    setDraftExpense(null);
    setShowAddExpense(true);
  };

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  return (
    <div className="relative space-y-5 pb-24">
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Business expense workspace</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryMetric label="This Month Expenses" value={fmt(kpis.this_month_expenses)} tone="warning" />
          <SummaryMetric label="Revenue" value={fmt(kpis.collected_revenue)} />
          <SummaryMetric label="Net Profit" value={fmt(kpis.net_profit)} tone={Number(kpis.net_profit || 0) < 0 ? 'danger' : 'success'} />
          <SummaryMetric
            label="Expense Growth"
            value={`${momExpenseChange > 0 ? '+' : ''}${momExpenseChange}%`}
            tone={momExpenseChange > 0 ? 'warning' : 'success'}
          />
        </div>
        <button
          type="button"
          onClick={openCreateExpense}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground active:scale-[0.99] transition-transform"
        >
          <Plus className="h-4 w-4" />
          Add expense now
        </button>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Quick filters" sub="Start broad, then narrow only if needed" />
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
              onClick={() => setRange(value)}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold ${
                range === value ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Category insights" sub="Business-wide spend by category" />
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {allCategories.map((category) => {
            const selected = selectedCategories.includes(category);
            const amount = Number(categories.find((item: any) => item.category === category)?.amount || 0);
            const percentage = Number(categories.find((item: any) => item.category === category)?.percentage || 0);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`min-w-[138px] rounded-2xl border p-3 text-left ${
                  selected ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground'
                }`}
              >
                <span className="text-xl">{categoryIcon(category)}</span>
                <span className="mt-2 block text-sm font-bold leading-tight">{category}</span>
                <span className={`mt-1 block text-xs ${selected ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                  {amount > 0 ? `${fmt(amount)} · ${percentage.toFixed(0)}%` : 'No spend'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <RecentExpensesSection
          expenses={expenses}
          total={Number(payload.total || expenses.length)}
          status={status}
          sort={sort}
          onStatusChange={setStatus}
          onSortChange={setSort}
          onSelectExpense={setSelectedExpense}
          onEditExpense={(expense) => {
            setEditingExpense(expense);
            setShowAddExpense(true);
          }}
          onDuplicateExpense={(expense) => {
            setDraftExpense(expense);
            setShowAddExpense(true);
          }}
        />
      </section>

      <MonthlyExpenseBreakdown categories={categories} maxCategory={maxCategory} />
      <TopVendors vendors={topVendors} />
      <CompactMonthlySummary latestMonth={latestMonth} previousMonth={previousMonth} />

      <section className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowInsights((value) => !value)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div>
            <h2 className="text-base font-semibold text-foreground">Expense insights</h2>
            <p className="text-xs text-muted-foreground">Collapsed by default so daily entry stays fast</p>
          </div>
          <Sparkles className="h-4 w-4 text-accent" />
        </button>
        {showInsights && (
          <IdleRender>
            <ExpenseInsights insights={insights} />
          </IdleRender>
        )}
      </section>

      <button
        type="button"
        onClick={openCreateExpense}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:scale-95 md:hidden"
        aria-label="Add expense"
      >
        <Plus className="h-6 w-6" />
      </button>

      {showAddExpense && (
        <Suspense fallback={null}>
          <AddExpenseModal
            categories={allCategories}
            mode={editingExpense ? 'edit' : 'create'}
            initialExpense={editingExpense || draftExpense}
            defaultHostelId={hostelId}
            defaultHostelLabel="This hostel"
            loading={createMutation.isPending || updateMutation.isPending}
            onClose={() => {
              setShowAddExpense(false);
              setEditingExpense(null);
              setDraftExpense(null);
            }}
            onSubmit={(body) => {
              if (editingExpense?.id) {
                updateMutation.mutate({ id: String(editingExpense.id), body });
                return;
              }
              createMutation.mutate(body);
            }}
          />
        </Suspense>
      )}
      {selectedExpense && (
        <ExpenseDetailsModal
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onEdit={() => {
            setEditingExpense(selectedExpense);
            setSelectedExpense(null);
            setShowAddExpense(true);
          }}
          onDuplicate={() => {
            setDraftExpense(selectedExpense);
            setSelectedExpense(null);
            setShowAddExpense(true);
          }}
          onMarkPending={() => {
            updateMutation.mutate({ id: String(selectedExpense.id), body: { status: 'pending' } });
            setSelectedExpense(null);
          }}
          onDelete={() => {
            deleteMutation.mutate(String(selectedExpense.id));
            setSelectedExpense(null);
          }}
        />
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  'Food & Groceries',
  'Staff Salary',
  'Electricity',
  'Water',
  'Gas Cylinders',
  'Internet',
  'Cleaning Supplies',
  'Maintenance & Repairs',
  'Security',
  'Laundry',
  'Transportation',
  'Furniture & Equipment',
  'Licenses & Government',
  'Marketing',
  'Medical & Emergency',
  'Miscellaneous',
];

function MonthlyExpenseBreakdown({
  categories,
  maxCategory,
}: {
  categories: Record<string, any>[];
  maxCategory: number;
}) {
  return (
    <section className="space-y-3">
      <SectionTitle
        title="Monthly expense breakdown"
        sub="What is consuming business cash this month"
      />
      <div className="rounded-2xl border border-border bg-card p-4">
        {categories.length === 0 ? (
          <EmptyMini text="Add expenses to see where the business is spending money." />
        ) : (
          <div className="space-y-3">
            {categories.slice(0, 8).map((cat) => (
              <div key={String(cat.category)}>
                <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                  <span className="font-semibold text-foreground">
                    {categoryIcon(String(cat.category))} {cat.category}
                  </span>
                  <span className="font-bold text-foreground">
                    {fmt(cat.amount)}
                  </span>
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
              </div>
            ))}
            <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">Total</span>
              <span className="text-lg font-bold text-foreground">
                {fmt(categories.reduce((sum, cat) => sum + Number(cat.amount || 0), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TopVendors({ vendors }: { vendors: { name: string; amount: number; count: number }[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Top vendors this month" sub="Who received the most money" />
      <div className="rounded-2xl border border-border bg-card p-4">
        {vendors.length === 0 ? (
          <EmptyMini text="Add vendor names while recording expenses to track repeat suppliers." />
        ) : (
          <div className="space-y-3">
            {vendors.slice(0, 5).map((vendor) => (
              <div key={vendor.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{vendor.name}</p>
                  <p className="text-[11px] text-muted-foreground">{vendor.count} payment{vendor.count === 1 ? '' : 's'}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">{fmt(vendor.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CompactMonthlySummary({
  latestMonth,
  previousMonth,
}: {
  latestMonth: Record<string, any>;
  previousMonth: Record<string, any>;
}) {
  const revenue = Number(latestMonth.revenue || 0);
  const expenses = Number(latestMonth.expenses || 0);
  const profit = Number(latestMonth.profit || 0);
  const change = getPercentChange(expenses, Number(previousMonth.expenses || 0));

  return (
    <section className="space-y-3">
      <SectionTitle title="Compact monthly summary" sub="Financial context without a large chart" />
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4">
        <SummaryMetric label="Revenue" value={fmt(revenue)} />
        <SummaryMetric label="Expenses" value={fmt(expenses)} tone={expenses > revenue * 0.6 ? 'warning' : 'default'} />
        <SummaryMetric label="Profit" value={fmt(profit)} tone={profit < 0 ? 'danger' : 'success'} />
        <SummaryMetric label="MoM expense" value={`${change > 0 ? '+' : ''}${change}%`} tone={change > 0 ? 'warning' : 'success'} />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const color =
    tone === 'success' ? 'text-success' :
    tone === 'warning' ? 'text-warning' :
    tone === 'danger' ? 'text-destructive' :
    'text-foreground';
  return (
    <div className="rounded-xl bg-background border border-border p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ExpenseInsights({ insights }: { insights: Record<string, any>[] }) {
  return (
    <div className="border-t border-border p-4">
      {insights.length === 0 ? (
        <EmptyMini text="Insights appear after a few expenses are recorded." />
      ) : (
        <div className="space-y-2">
          {insights.slice(0, 4).map((insight, i) => (
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
      )}
    </div>
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

function categoryTone(category: string) {
  const tones: Record<string, { chip: string; bar: string }> = {
    'Food & Groceries': { chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
    Electricity: { chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
    Water: { chip: 'bg-info/10 text-info', bar: 'bg-info' },
    'Gas Cylinders': { chip: 'bg-orange-500/10 text-orange-600', bar: 'bg-orange-500' },
    Internet: { chip: 'bg-accent/10 text-accent', bar: 'bg-accent' },
    'Staff Salary': { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    'Maintenance & Repairs': { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    'Cleaning Supplies': { chip: 'bg-emerald-500/10 text-emerald-600', bar: 'bg-emerald-500' },
    Security: { chip: 'bg-red-500/10 text-red-600', bar: 'bg-red-500' },
    Laundry: { chip: 'bg-sky-500/10 text-sky-600', bar: 'bg-sky-500' },
    Transportation: { chip: 'bg-amber-500/10 text-amber-600', bar: 'bg-amber-500' },
    'Furniture & Equipment': { chip: 'bg-purple-500/10 text-purple-600', bar: 'bg-purple-500' },
    'Licenses & Government': { chip: 'bg-slate-500/10 text-slate-600', bar: 'bg-slate-500' },
    Marketing: { chip: 'bg-pink-500/10 text-pink-600', bar: 'bg-pink-500' },
    'Medical & Emergency': { chip: 'bg-rose-500/10 text-rose-600', bar: 'bg-rose-500' },
  };
  return tones[category] || { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' };
}

function severityDot(severity: string) {
  if (severity === 'dangerous') return 'bg-destructive';
  if (severity === 'warning') return 'bg-warning';
  return 'bg-success';
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

function ExpenseEmptyState() {
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

const RecentExpensesSection = memo(function RecentExpensesSection({
  expenses,
  total,
  status,
  sort,
  onStatusChange,
  onSortChange,
  onSelectExpense,
  onEditExpense,
  onDuplicateExpense,
}: {
  expenses: Record<string, any>[];
  total: number;
  status: string;
  sort: string;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onSelectExpense: (expense: Record<string, any>) => void;
  onEditExpense: (expense: Record<string, any>) => void;
  onDuplicateExpense: (expense: Record<string, any>) => void;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const filteredExpenses = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((expense) =>
      [
        expense.title,
        expense.vendor_name,
        expense.notes,
        expense.category,
        expense.payment_method,
        expense.amount,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [deferredSearch, expenses]);

  const subtitle = search.trim()
    ? `${filteredExpenses.length} matching ${total} entries`
    : `${total} entries`;

  return (
    <>
      <SectionTitle title="Recent expenses" sub={subtitle} />
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <select value={status} onChange={(e) => onStatusChange(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={sort} onChange={(e) => onSortChange(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
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
      </div>

      {expenses.length === 0 ? (
        <ExpenseEmptyState />
      ) : filteredExpenses.length === 0 ? (
        <EmptyMini text="No expenses match this search." />
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <ExpenseCard
              key={String(expense.id)}
              expense={expense}
              onView={() => onSelectExpense(expense)}
              onEdit={() => onEditExpense(expense)}
              onDuplicate={() => onDuplicateExpense(expense)}
              onDelete={() => deleteMutation.mutate(String(expense.id))}
            />
          ))}
        </div>
      )}
    </>
  );
});

function ExpenseCard({
  expense,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  expense: Record<string, any>;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  const status = String(expense.status || 'paid').toUpperCase();
  const date = expense.date
    ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : 'No date';
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${tone.chip}`}>
              {String(expense.category || 'Misc')}
            </span>
            {expense.receipt_url && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {expense.is_recurring && <Repeat2 className="h-3.5 w-3.5 shrink-0 text-accent" />}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">
            {String(expense.title || expense.vendor_name || 'Expense')}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[expense.vendor_name, expense.payment_method ? `via ${expense.payment_method}` : null, date]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-foreground">{fmt(expense.amount)}</p>
          <p className={`mt-1 text-[10px] font-semibold ${
            status === 'PAID' ? 'text-success' : status === 'CANCELLED' ? 'text-destructive' : 'text-warning'
          }`}>
            {status}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {date}
        </span>
      </div>

      {!confirmDelete ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <button type="button" onClick={onView} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-1 py-2 text-[11px] font-semibold hover:bg-muted active:scale-[0.98] transition-all">
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            View
          </button>
          <button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-1 py-2 text-[11px] font-semibold hover:bg-muted active:scale-[0.98] transition-all">
            <Edit3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            Edit
          </button>
          <button type="button" onClick={onDuplicate} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-1 py-2 text-[11px] font-semibold hover:bg-muted active:scale-[0.98] transition-all">
            <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            Copy
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-destructive/20 bg-destructive/[0.02] px-1 py-2 text-[11px] font-semibold text-destructive hover:bg-destructive/5 active:scale-[0.98] transition-all">
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            Delete
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 bg-destructive/5 rounded-xl border border-destructive/20 p-2 text-[11px]">
          <span className="font-semibold text-destructive pl-1">Delete expense?</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 font-bold rounded-lg border border-border bg-card text-foreground active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-2.5 py-1 font-bold rounded-lg bg-destructive text-destructive-foreground active:scale-[0.98]"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseDetailsModal({
  expense,
  onClose,
  onEdit,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  const status = String(expense.status || 'paid').toUpperCase();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:p-4 sm:items-center">
      {/* Background click-away backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Drag handle line for mobile bottom sheet feeling */}
        <div className="w-12 h-1 bg-border/80 rounded-full mx-auto mt-3 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/50 shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expense Details</span>
            <p className="text-lg font-extrabold text-foreground truncate mt-0.5">{String(expense.title || 'Expense')}</p>
            <p className="text-xl font-black text-accent mt-0.5">{fmt(expense.amount)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-muted text-muted-foreground active:scale-95 transition-transform mt-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Details Table */}
          <div className="divide-y divide-border/60 rounded-2xl border border-border bg-background/50 overflow-hidden">
            <DetailRow label="Category" value={String(expense.category || 'Miscellaneous')} rightElement={<span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone.chip}`}>{String(expense.category || 'Misc')}</span>} />
            <DetailRow label="Status" value={status} rightElement={<span className={`text-xs font-bold ${status === 'PAID' ? 'text-success' : status === 'CANCELLED' ? 'text-destructive' : 'text-warning'}`}>{status}</span>} />
            <DetailRow label="Payment" value={expense.payment_method ? `Paid via ${expense.payment_method}` : 'Not set'} />
            <DetailRow label="Date" value={expense.date ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'} />
            <DetailRow label="Vendor" value={String(expense.vendor_name || 'Not set')} />
            <DetailRow label="Recorded by" value={String(expense.added_by || 'Owner')} />
          </div>

          {expense.notes && (
            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="mt-1.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">{String(expense.notes)}</p>
            </div>
          )}

          {expense.receipt_url && (
            <a
              href={String(expense.receipt_url)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-xs font-bold hover:bg-muted active:scale-[0.98] transition-all"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              Open attached bill
            </a>
          )}
        </div>

        {/* Sticky Actions Footer */}
        <div className="border-t border-border/50 bg-muted/20 p-4 shrink-0 pb-[calc(1.2rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
          {!confirmDelete ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onEdit} className="rounded-xl border border-border bg-card py-2.5 text-xs font-bold active:scale-[0.98] transition-all">
                Edit
              </button>
              <button type="button" onClick={onDuplicate} className="rounded-xl border border-border bg-card py-2.5 text-xs font-bold active:scale-[0.98] transition-all">
                Duplicate
              </button>
              <button type="button" onClick={onMarkPending} className="rounded-xl border border-border bg-card py-2.5 text-xs font-bold active:scale-[0.98] transition-all">
                Mark Pending
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-xs font-bold text-destructive active:scale-[0.98] transition-all">
                Delete
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-3">
              <p className="text-xs text-destructive font-semibold text-center">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-border bg-card text-foreground active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/95 text-center active:scale-[0.98]"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, rightElement }: { label: string; value: string; rightElement?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      {rightElement ? (
        rightElement
      ) : (
        <span className="font-bold text-foreground truncate max-w-[200px]">{value}</span>
      )}
    </div>
  );
}

function getTopVendors(expenses: Record<string, any>[]) {
  const vendors = new Map<string, { name: string; amount: number; count: number }>();
  for (const expense of expenses) {
    const name = String(expense.vendor_name || '').trim();
    if (!name) continue;
    const current = vendors.get(name.toLowerCase()) || { name, amount: 0, count: 0 };
    current.amount += Number(expense.amount || 0);
    current.count += 1;
    vendors.set(name.toLowerCase(), current);
  }
  return [...vendors.values()].sort((a, b) => b.amount - a.amount);
}

function getPercentChange(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function categoryIcon(category: string) {
  if (category.includes('Food')) return '🍚';
  if (category.includes('Electric')) return '⚡';
  if (category.includes('Water')) return '💧';
  if (category.includes('Staff')) return '👨‍🍳';
  if (category.includes('Repair') || category.includes('Maintenance')) return '🔧';
  if (category.includes('Gas')) return '🔥';
  if (category.includes('Internet')) return '📶';
  if (category.includes('Cleaning')) return '🧹';
  if (category.includes('Security')) return '🛡️';
  if (category.includes('Laundry')) return '🧺';
  if (category.includes('Transportation')) return '🛺';
  if (category.includes('Furniture') || category.includes('Equipment')) return '🧾';
  if (category.includes('Licenses') || category.includes('Government')) return '📄';
  if (category.includes('Marketing')) return '📣';
  if (category.includes('Medical')) return '🩺';
  return '•';
}
