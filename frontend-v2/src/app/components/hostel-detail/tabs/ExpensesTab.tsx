import { lazy, Suspense, memo, useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Eye, Paperclip, Plus, Repeat2, Search, Sparkles, UserRound, X, Zap } from 'lucide-react';
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
      toast.success('Expense added');
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      setShowAddExpense(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not add expense');
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

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  return (
    <div className="relative space-y-5 pb-24">
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expense workspace</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{fmt(kpis.this_month_expenses)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Spent this month</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${momExpenseChange > 0 ? 'text-warning' : 'text-success'}`}>
              {momExpenseChange > 0 ? '+' : ''}{momExpenseChange}%
            </p>
            <p className="text-[11px] text-muted-foreground">vs last month</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddExpense(true)}
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
        <SectionTitle title="Categories" sub="Swipe to filter the expenses owners check most" />
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {allCategories.slice(0, 10).map((category) => {
            const selected = selectedCategories.includes(category);
            const amount = Number(categories.find((item: any) => item.category === category)?.amount || 0);
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
                  {amount > 0 ? fmt(amount) : 'No spend'}
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
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:scale-95 md:hidden"
        aria-label="Add expense"
      >
        <Plus className="h-6 w-6" />
      </button>

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
      {selectedExpense && (
        <ExpenseDetailsModal
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onDuplicate={() => {
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
  'Gas Cylinder',
  'Internet',
  'Repairs',
  'Cleaning',
  'Asset Purchase',
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
        sub="What is consuming hostel cash this month"
      />
      <div className="rounded-2xl border border-border bg-card p-4">
        {categories.length === 0 ? (
          <EmptyMini text="Add expenses to see where the hostel is spending money." />
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
    'Gas Cylinder': { chip: 'bg-orange-500/10 text-orange-600', bar: 'bg-orange-500' },
    Internet: { chip: 'bg-accent/10 text-accent', bar: 'bg-accent' },
    'Staff Salary': { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    Repairs: { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    Cleaning: { chip: 'bg-emerald-500/10 text-emerald-600', bar: 'bg-emerald-500' },
    'Asset Purchase': { chip: 'bg-purple-500/10 text-purple-600', bar: 'bg-purple-500' },
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
      <h3 className="mt-4 text-lg font-bold text-foreground">Start tracking hostel operations</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Track electricity, food, maintenance and staff costs to understand profitability.
      </p>
      <div className="mt-4 grid gap-2 text-left text-xs text-muted-foreground">
        <div className="rounded-lg bg-background border border-border p-3">Food cost vs revenue insight</div>
        <div className="rounded-lg bg-background border border-border p-3">Expense per occupied bed</div>
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
}: {
  expenses: Record<string, any>[];
  total: number;
  status: string;
  sort: string;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onSelectExpense: (expense: Record<string, any>) => void;
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
}: {
  expense: Record<string, any>;
  onView: () => void;
}) {
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  const status = String(expense.status || 'paid').toUpperCase();
  const date = expense.date
    ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : 'No date';
  return (
    <button
      type="button"
      onClick={onView}
      className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-accent/40 active:scale-[0.99]"
    >
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
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <Eye className="h-3.5 w-3.5" />
          Details
        </span>
      </div>
    </button>
  );
}

function ExpenseDetailsModal({
  expense,
  onClose,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  onClose: () => void;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground">{String(expense.title || 'Expense')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{fmt(expense.amount)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Category" value={String(expense.category || 'Miscellaneous')} chipClass={tone.chip} />
          <DetailItem label="Status" value={String(expense.status || 'paid').toUpperCase()} />
          <DetailItem label="Payment" value={expense.payment_method ? `Paid via ${expense.payment_method}` : 'Not set'} />
          <DetailItem label="Date" value={expense.date ? new Date(String(expense.date)).toLocaleDateString('en-IN') : 'No date'} />
          <DetailItem label="Vendor" value={String(expense.vendor_name || 'Not set')} />
          <DetailItem label="Recorded by" value={String(expense.added_by || 'Owner')} />
        </div>

        {expense.notes && (
          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm text-foreground">{String(expense.notes)}</p>
          </div>
        )}

        {expense.receipt_url && (
          <a
            href={String(expense.receipt_url)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
          >
            <Paperclip className="h-4 w-4" />
            Open attached bill
          </a>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={onDuplicate} className="rounded-xl border border-border py-2.5 text-xs font-semibold">
            Duplicate
          </button>
          <button type="button" onClick={onMarkPending} className="rounded-xl border border-border py-2.5 text-xs font-semibold">
            Mark Pending
          </button>
          <button type="button" onClick={onDelete} className="rounded-xl border border-destructive/30 py-2.5 text-xs font-semibold text-destructive">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, chipClass }: { label: string; value: string; chipClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${chipClass ? `inline-block rounded-full px-2 py-1 ${chipClass}` : 'text-foreground'}`}>
        {value}
      </p>
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
  if (category.includes('Repair')) return '🔧';
  if (category.includes('Gas')) return '🔥';
  if (category.includes('Internet')) return '📶';
  if (category.includes('Cleaning')) return '🧹';
  if (category.includes('Asset')) return '🧾';
  return '•';
}
