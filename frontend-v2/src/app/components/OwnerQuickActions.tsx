import { lazy, Suspense, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Plus, Receipt, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';

const AddTenantModal = lazy(() => import('./modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal })));
const RecordPaymentModal = lazy(() => import('./modals/RecordPaymentModal').then((m) => ({ default: m.RecordPaymentModal })));
const AddExpenseModal = lazy(() => import('./hostel-detail/tabs/expenses/AddExpenseModal').then((m) => ({ default: m.AddExpenseModal })));

type Action = 'menu' | 'payment' | 'tenant' | 'expense' | null;

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

function unwrapHostels(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const obj = raw as Record<string, unknown> | undefined;
  if (Array.isArray(obj?.hostels)) return obj.hostels as Record<string, unknown>[];
  if (Array.isArray((obj?.data as Record<string, unknown> | undefined)?.hostels)) {
    return (obj?.data as Record<string, unknown>).hostels as Record<string, unknown>[];
  }
  return [];
}

export function OwnerQuickActions() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Action>(null);
  const hidden =
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/tenant') ||
    location.pathname.startsWith('/hostels/') ||
    location.pathname.startsWith('/billing') ||
    location.pathname.startsWith('/alerts');

  const { data } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60_000,
    enabled: !hidden && active !== null,
  });

  const hostels = unwrapHostels(data);
  const hostelId = String(hostels[0]?.id ?? '');
  const canUseHostelActions = Boolean(hostelId);

  const createExpenseMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(undefined, body)),
    onSuccess: () => {
      toast.success('Expense added');
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('business') });
      if (hostelId) queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      setActive(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not add expense');
    },
  });

  if (hidden) return null;

  return (
    <>
      {active === 'menu' && (
        <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setActive(null)}>
          <div
            className="absolute bottom-24 right-4 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-xl md:bottom-6 md:right-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-sm font-semibold text-foreground">Quick actions</p>
              <button type="button" onClick={() => setActive(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canUseHostelActions}
                onClick={() => setActive('payment')}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium disabled:opacity-50"
              >
                <IndianRupee className="h-4 w-4 text-accent" />
                <span>
                  <span className="block">Quick collect</span>
                  <span className="block text-xs font-normal text-muted-foreground">Tenant search, amount, cash or UPI</span>
                </span>
              </button>
              <button
                type="button"
                disabled={!canUseHostelActions}
                onClick={() => setActive('tenant')}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 text-accent" />
                Add tenant
              </button>
              <button
                type="button"
                onClick={() => setActive('expense')}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium disabled:opacity-50"
              >
                <Receipt className="h-4 w-4 text-accent" />
                Add expense
              </button>

              <button
                type="button"
                onClick={() => {
                  setActive(null);
                  navigate('/tenants');
                }}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium"
              >
                <Search className="h-4 w-4 text-accent" />
                Find tenant
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setActive(active === 'menu' ? null : 'menu')}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl transition-transform active:scale-95 md:bottom-6 md:right-6"
        aria-label="Open quick actions"
      >
        <Plus className={`h-6 w-6 transition-transform ${active === 'menu' ? 'rotate-45' : ''}`} />
      </button>

      {active === 'payment' && hostelId && (
        <Suspense fallback={null}>
          <RecordPaymentModal hostelId={hostelId} onClose={() => setActive(null)} />
        </Suspense>
      )}
      {active === 'tenant' && hostelId && (
        <Suspense fallback={null}>
          <AddTenantModal hostelId={hostelId} onClose={() => setActive(null)} />
        </Suspense>
      )}
      {active === 'expense' && (
        <Suspense fallback={null}>
          <AddExpenseModal
            categories={EXPENSE_CATEGORIES}
            loading={createExpenseMutation.isPending}
            onClose={() => setActive(null)}
            onSubmit={(body) => createExpenseMutation.mutate(body)}
          />
        </Suspense>
      )}

    </>
  );
}
