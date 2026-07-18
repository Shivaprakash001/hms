import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@lib/queryKeys';
import { TabError, TabSkeleton } from '../shared/TabStates';
import { IdleRender } from '@/shared/performance';
import { EXPENSE_CATEGORIES } from '@features/expenses/constants';
import { ExpenseDashboard } from './expenses/ExpenseDashboard';
import { ExpenseFilterBar, type ExpenseFilterState } from './expenses/ExpenseFilterBar';
import { ExpenseList } from './expenses/ExpenseList';
import { ExpenseCategoryBreakdown } from './expenses/ExpenseCategoryBreakdown';
import { ExpenseVendors } from './expenses/ExpenseVendors';
import { ExpenseInsightsPanel } from './expenses/ExpenseInsightsPanel';
import { ExpenseExportMenu, type ExpenseExportFormat, type ExpenseExportScope } from './expenses/ExpenseExportMenu';

const AddExpenseModal = lazy(() => import('./expenses/AddExpenseModal').then((m) => ({ default: m.AddExpenseModal })));
const ExpenseDetailsModal = lazy(() => import('./expenses/ExpenseDetailsModal').then((m) => ({ default: m.ExpenseDetailsModal })));

const DEFAULT_FILTERS: ExpenseFilterState = {
  range: 'month',
  customStart: '',
  customEnd: '',
  status: 'all',
  sort: 'recent',
  searchTerm: '',
  selectedCategories: [],
  vendor: '',
  paymentMethod: '',
  recurring: '',
  amountMin: '',
  amountMax: '',
};

export function ExpensesTab({ hostelId }: { hostelId: string }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ExpenseFilterState>(DEFAULT_FILTERS);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Record<string, any> | null>(null);
  const [draftExpense, setDraftExpense] = useState<Record<string, any> | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Record<string, any> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const updateFilters = (patch: Partial<ExpenseFilterState>) => setFilters((f) => ({ ...f, ...patch }));

  const deferredSearchTerm = useDeferredValue(filters.searchTerm);
  // Vendor/payment-method filters ride on the existing server-side `search` substring
  // match (title/notes/vendor_name/payment_method/category) — no dedicated params needed.
  const combinedSearch = [deferredSearchTerm.trim(), filters.vendor, filters.paymentMethod].filter(Boolean).join(' ') || undefined;

  const params = useMemo(
    () => ({
      range: filters.range,
      startDate: filters.range === 'custom' ? filters.customStart : undefined,
      endDate: filters.range === 'custom' ? filters.customEnd : undefined,
      status: filters.status,
      sort: filters.sort,
      categories: filters.selectedCategories.join(','),
      search: combinedSearch,
      recurring: filters.recurring === '' ? undefined : filters.recurring === 'true',
      amountMin: filters.amountMin !== '' && Number.isFinite(Number(filters.amountMin)) ? Number(filters.amountMin) : undefined,
      amountMax: filters.amountMax !== '' && Number.isFinite(Number(filters.amountMax)) ? Number(filters.amountMax) : undefined,
      limit: 40,
    }),
    [filters, combinedSearch],
  );

  const targetHostelId = hostelId === 'all' ? undefined : hostelId;
  const queryHostelKey = hostelId || 'business';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.list(queryHostelKey), params],
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getAll(targetHostelId, params)),
    staleTime: 2 * 60 * 1000,
    // Keep showing the previous result set while a new filter/search combination
    // fetches in the background, instead of unmounting the whole tab into TabSkeleton
    // on every keystroke (each keystroke changes `params`, and therefore the query key).
    placeholderData: keepPreviousData,
  });

  // Lightweight second query for the dashboard's "Largest Expense" card — exact,
  // reuses the existing sort=highest mode, no new backend endpoint needed.
  const { data: largestData } = useQuery({
    queryKey: [...queryKeys.expenses.list(queryHostelKey), params, 'largest'],
    queryFn: () =>
      import('@features/expenses/api').then((m) =>
        m.expenseService.getAll(targetHostelId, { ...params, sort: 'highest', limit: 1, offset: 0 }),
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const invalidateExpenseQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(queryHostelKey) });
    if (hostelId !== 'all') {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('all') });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('business') });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(targetHostelId, body)),
    onSuccess: () => {
      toast.success('Expense added');
      invalidateExpenseQueries();
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
      invalidateExpenseQueries();
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
      invalidateExpenseQueries();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not delete expense');
    },
  });

  const payload = (data || {}) as Record<string, any>;
  const expenses: Record<string, any>[] = Array.isArray(payload.expenses) ? payload.expenses : [];
  const kpis = payload.kpis || {};
  const categoryBreakdown = Array.isArray(payload.category_breakdown) ? payload.category_breakdown : [];
  const vendorBreakdown = Array.isArray(payload.vendor_breakdown) ? payload.vendor_breakdown : [];
  const insights = Array.isArray(payload.insights) ? payload.insights : [];
  const monthlyTrend = Array.isArray(payload.monthly_trend) ? payload.monthly_trend : [];
  const allCategories: string[] = payload.meta?.categories || EXPENSE_CATEGORIES;
  const largestExpense = Array.isArray(largestData?.expenses) ? largestData.expenses[0] || null : null;

  const hasActiveFilters = Boolean(
    filters.searchTerm.trim() ||
      filters.selectedCategories.length > 0 ||
      filters.status !== 'all' ||
      filters.vendor ||
      filters.paymentMethod ||
      filters.recurring !== '' ||
      filters.amountMin ||
      filters.amountMax,
  );

  const openCreateExpense = () => {
    setEditingExpense(null);
    setDraftExpense(null);
    setShowAddExpense(true);
  };

  const filterToCategory = (category: string) => updateFilters({ selectedCategories: [category] });
  const markPending = (expense: Record<string, any>) =>
    updateMutation.mutate({ id: String(expense.id), body: { status: 'pending' } });

  const toggleSelect = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAllVisible = () => setSelectedIds(new Set(expenses.map((e) => String(e.id))));
  const clearSelection = () => setSelectedIds(new Set());

  const handleExport = async ({ format, scope }: { format: ExpenseExportFormat; scope: ExpenseExportScope }) => {
    setExporting(true);
    try {
      const exportParams: Record<string, unknown> = {
        format,
        scope,
        range: filters.range,
        startDate: filters.range === 'custom' ? filters.customStart : undefined,
        endDate: filters.range === 'custom' ? filters.customEnd : undefined,
        status: filters.status,
        sort: filters.sort,
        categories: filters.selectedCategories.join(','),
        search: combinedSearch,
        recurring: filters.recurring === '' ? undefined : filters.recurring,
        amountMin: filters.amountMin || undefined,
        amountMax: filters.amountMax || undefined,
        // Display-only, for the report's Filter Snapshot — actual row filtering already
        // happens server-side via `search` (see combinedSearch above).
        vendor: filters.vendor || undefined,
        paymentMethod: filters.paymentMethod || undefined,
      };
      if (targetHostelId) exportParams.hostelId = targetHostelId;
      if (scope === 'current_view') {
        exportParams.limit = params.limit;
        exportParams.offset = 0;
      }
      if (scope === 'selected') {
        exportParams.ids = Array.from(selectedIds).join(',');
      }

      // Deliberately not `const { blob, filename } = await import(...).then((m) => m.expenseService.export(...))` —
      // that shape makes Vite's production preload-wrapping transform mis-generate the dynamic
      // import's inner wrapper (it destructures `blob`/`filename` off the module namespace instead
      // of the export() result), throwing "Cannot read properties of undefined (reading 'export')"
      // in the built bundle only (not in `vite dev`). Splitting the import from the call avoids it.
      const { expenseService } = await import('@features/expenses/api');
      const { blob, filename } = await expenseService.export(exportParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Export ready');
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  return (
    <div className="relative space-y-5 pb-24">
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Business expense workspace</p>
        <button
          type="button"
          onClick={openCreateExpense}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground active:scale-[0.99] transition-transform"
        >
          <Plus className="h-4 w-4" />
          Add expense now
        </button>
      </section>

      <ExpenseDashboard
        kpis={kpis}
        categoryBreakdown={categoryBreakdown}
        vendorBreakdown={vendorBreakdown}
        monthlyTrend={monthlyTrend}
        largestExpense={largestExpense}
        onFilterCategory={filterToCategory}
        onOpenExpense={setSelectedExpense}
      />

      <ExpenseFilterBar
        filters={filters}
        onChange={updateFilters}
        allCategories={allCategories}
        categoryBreakdown={categoryBreakdown}
        vendorOptions={vendorBreakdown}
        trailingActions={
          <ExpenseExportMenu
            onExport={handleExport}
            exporting={exporting}
            currentViewCount={expenses.length}
            totalCount={Number(payload.total || expenses.length)}
            selectedCount={selectedIds.size}
          />
        }
      />

      <ExpenseList
        expenses={expenses}
        total={Number(payload.total || expenses.length)}
        searchTerm={filters.searchTerm}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => setFilters(DEFAULT_FILTERS)}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onSelectAllVisible={selectAllVisible}
        onClearSelection={clearSelection}
        onSelectExpense={setSelectedExpense}
        onEditExpense={(expense) => {
          setEditingExpense(expense);
          setShowAddExpense(true);
        }}
        onDuplicateExpense={(expense) => {
          setDraftExpense(expense);
          setShowAddExpense(true);
        }}
        onMarkPending={markPending}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <ExpenseCategoryBreakdown categories={categoryBreakdown} onFilterCategory={filterToCategory} />
      <ExpenseVendors vendors={vendorBreakdown} />
      <IdleRender>
        <ExpenseInsightsPanel insights={insights} onFilterCategory={filterToCategory} />
      </IdleRender>

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
        <Suspense fallback={null}>
          <ExpenseDetailsModal
            expense={selectedExpense}
            categoryBreakdown={categoryBreakdown}
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
              markPending(selectedExpense);
              setSelectedExpense(null);
            }}
            onDelete={() => {
              deleteMutation.mutate(String(selectedExpense.id));
              setSelectedExpense(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
