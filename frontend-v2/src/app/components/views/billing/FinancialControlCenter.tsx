import { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  BarChart3, ChevronDown, Phone, Calendar, DollarSign, Receipt, X, Clock
} from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { OwnerActionsBar } from './OwnerActionsBar';
import { PaymentLedger } from './PaymentLedger';
import { RecordPaymentModal } from '../../modals/RecordPaymentModal';

const CashflowForecast = lazy(() => import('./CashflowForecast').then((m) => ({ default: m.CashflowForecast })));
const CollectionAnalytics = lazy(() => import('./CollectionAnalytics').then((m) => ({ default: m.CollectionAnalytics })));
const ExpenseIntelligence = lazy(() => import('./ExpenseIntelligence').then((m) => ({ default: m.ExpenseIntelligence })));
const PaymentDetailDrawer = lazy(() => import('./PaymentDetailDrawer').then((m) => ({ default: m.PaymentDetailDrawer })));
const AddExpenseModal = lazy(() => import('../../hostel-detail/tabs/expenses/AddExpenseModal').then((m) => ({ default: m.AddExpenseModal })));

interface Props {
  hostelId: string;
  onRecordPayment?: () => void;
  onAddExpense?: () => void;
}

function AnalyticsFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="h-44 rounded-xl bg-muted animate-pulse" />
      <div className="h-44 rounded-xl bg-muted animate-pulse" />
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.062 5.248 5.31 0 11.779 0c3.136.001 6.086 1.222 8.31 3.448 2.223 2.225 3.443 5.177 3.44 8.31-.005 6.545-5.253 11.793-11.722 11.793-1.996-.001-3.957-.509-5.698-1.474L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.793 1.451 5.378 0 9.756-4.379 9.76-9.761.002-2.607-1.01-5.059-2.85-6.902C16.452 2.097 13.997 1.08 11.391 1.08c-5.385 0-9.766 4.381-9.77 9.763-.001 1.624.42 3.208 1.22 4.61L1.82 21.848l6.09-1.597zM17.06 13.9c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-2.63-1.1-4.22-2.45-5.07-3.92-.22-.38.22-.35.63-1.16.08-.15.04-.28-.02-.43-.06-.15-.48-1.16-.66-1.59-.17-.42-.35-.36-.48-.37l-.4-.01c-.15 0-.4.06-.6.28-.2.22-.78.76-.78 1.86s.8 2.16.9 2.3c.12.15 1.58 2.41 3.83 3.38 2.25.97 2.25.65 2.65.61.4-.04 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.28-.21-.58-.36z"/>
    </svg>
  );
}

function fmtK(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

function dueBalance(due: Record<string, unknown>): number {
  const value = due.outstanding ?? due.remaining ?? due.balance ?? due.amount ?? 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
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

interface OutstandingDuesDrawerProps {
  hostelId: string;
  dues: any[];
  onClose: () => void;
  onCollect: (due: any) => void;
}

function OutstandingDuesDrawer({ hostelId, dues, onClose, onCollect }: OutstandingDuesDrawerProps) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dues;
    return dues.filter(d => {
      const name = String(d.tenant_name ?? d.name ?? '').toLowerCase();
      const room = String(d.room_no ?? d.room_number ?? '').toLowerCase();
      const phone = String(d.phone ?? d.tenant_phone ?? '').toLowerCase();
      return name.includes(q) || room.includes(q) || phone.includes(q);
    });
  }, [search, dues]);

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-45" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[460px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between bg-muted/10 shrink-0">
          <div>
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5 text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              All Outstanding Dues
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{dues.length} tenants pending payment</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-border bg-card shrink-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search outstanding tenants..."
            className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.map((due, idx) => {
            const tenantName = due.tenant_name ?? due.name ?? 'Tenant';
            const roomNo = due.room_no ?? due.room_number ?? 'N/A';
            const balance = dueBalance(due);
            const rawPhone = due.phone ?? due.tenant_phone ?? due.tenantPhone;
            const phone = rawPhone ? String(rawPhone).trim() : null;
            const telPhone = phone ? phone.replace(/[^\d+]/g, '') : null;
            
            const dueTime = due.due_date ? new Date(String(due.due_date)).getTime() : 0;
            const isOverdue = dueTime < Date.now();
            const daysLate = isOverdue ? Math.max(0, Math.floor((Date.now() - dueTime) / (1000 * 60 * 60 * 24))) : 0;

            let whatsappUrl = null;
            if (phone) {
              let clean = phone.replace(/[^\d]/g, '');
              if (clean.length === 10) clean = '91' + clean;
              const msg = `Hi ${tenantName}, this is a friendly reminder regarding your rent of ${fmtK(balance)} which is ${daysLate > 0 ? `${daysLate} days overdue` : 'due'}. Please clear it at your earliest convenience. Thank you!`;
              whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
            }

            return (
              <div key={due.id ?? idx} className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{tenantName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Room {roomNo}</p>
                    {isOverdue && daysLate > 0 ? (
                      <span className="text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                        {daysLate} days late
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                        Due: {due.due_date ? new Date(due.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{fmtK(balance)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">outstanding</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-border/50 pt-2.5">
                  {telPhone && (
                    <a
                      href={`tel:${telPhone}`}
                      className="w-8 h-8 flex items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full active:scale-95 transition-all shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-full active:scale-95 transition-all shrink-0"
                    >
                      <WhatsAppIcon />
                    </a>
                  )}
                  <button
                    onClick={() => onCollect(due)}
                    className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-primary/95 active:scale-[0.98] transition-all"
                  >
                    Collect
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8">No matching outstanding dues found.</div>
          )}
        </div>
      </div>
    </>
  );
}

export function FinancialControlCenter({ hostelId }: Props) {
  const queryClient = useQueryClient();
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  
  // Modals & Drawers states
  const [showDuesDrawer, setShowDuesDrawer] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [recordPayment, setRecordPayment] = useState<{ hostelId: string; dueId?: string; amount?: string } | null>(null);

  // Queries
  const { data: statsShell, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboard.statsShell(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getStatsShell(hostelId)),
    staleTime: 2 * 60 * 1000,
    enabled: !!hostelId,
  });

  const { data: statsAnalytics } = useQuery({
    queryKey: queryKeys.dashboard.statsAnalytics(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getStatsAnalytics(hostelId)),
    staleTime: 3 * 60 * 1000,
    enabled: !!hostelId,
  });

  const { data: statsActivity } = useQuery({
    queryKey: queryKeys.dashboard.statsActivity(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getStatsActivity(hostelId)),
    staleTime: 60 * 1000,
    enabled: !!hostelId,
  });

  const { data: cashflow } = useQuery({
    queryKey: queryKeys.dashboard.cashflow(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getCashflow(hostelId)),
    staleTime: 3 * 60 * 1000,
    enabled: !!hostelId,
  });

  const { data: funnel } = useQuery({
    queryKey: queryKeys.dashboard.funnel(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getFunnel(hostelId)),
    staleTime: 5 * 60 * 1000,
    enabled: !!hostelId,
  });

  const { data: paymentsData, refetch: refetchPayments } = useQuery({
    queryKey: queryKeys.payments.ledger(hostelId, { limit: 40 }),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAll(hostelId, { limit: 40 })),
    staleTime: 2 * 60 * 1000,
    enabled: !!hostelId,
  });

  const { data: duesData, refetch: refetchDues } = useQuery({
    queryKey: queryKeys.payments.dues(hostelId),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAllDues(hostelId)),
    enabled: !!hostelId,
    staleTime: 60 * 1000,
  });

  const { data: pendingPaymentsData } = useQuery({
    queryKey: ['payments', 'pending-verification', hostelId],
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getPendingVerifications(hostelId)),
    enabled: !!hostelId,
    staleTime: 60 * 1000,
  });

  // Expense Create mutation
  const createExpenseMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(undefined, body)),
    onSuccess: () => {
      toast.success('Expense added');
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all('business') });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      setShowAddExpense(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.message || 'Could not add expense');
    },
  });

  const handleRowClick = useCallback((id: string) => setSelectedObligationId(id), []);

  const stats = useMemo(() => {
    if (!statsShell) return statsShell;
    const shellIntel = statsShell.intelligence ?? {};
    const analytics = statsAnalytics ?? {};
    const activity = statsActivity ?? {};

    return {
      ...statsShell,
      intelligence: {
        ...shellIntel,
        revenue: {
          ...(shellIntel.revenue ?? {}),
          ...(analytics.revenue ?? {}),
        },
        occupancy: {
          ...(shellIntel.occupancy ?? {}),
          ...(analytics.occupancy ?? {}),
        },
        dues: {
          ...(shellIntel.dues ?? {}),
          ...(analytics.dues ?? {}),
          reminder_conversion: analytics.dues?.reminder_conversion ?? shellIntel.dues?.reminder_conversion,
        },
        payment_attempts: analytics.payment_attempts ?? shellIntel.payment_attempts,
        recent_activity: activity.recent_activity ?? shellIntel.recent_activity ?? [],
      },
    };
  }, [statsShell, statsAnalytics, statsActivity]);

  const intel = stats?.intelligence;
  const payments: any[] = Array.isArray(paymentsData?.payments) ? paymentsData.payments : Array.isArray(paymentsData) ? paymentsData : [];

  // Calculate Expected/Collected/Outstanding/Expenses MTD
  const expectedVal = stats?.expected_revenue ?? 0;
  const collectedVal = stats?.revenue ?? 0;
  const outstandingVal = stats?.pending_dues ?? 0;
  const expensesVal = stats?.monthly_expenses ?? stats?.expenses ?? 0;
  const collectionRate = stats?.collection_rate ?? 0;
  const netCashFlow = collectedVal - expensesVal;
  const activeTenants = stats?.active_tenants ?? stats?.total_tenants ?? 0;
  const perTenantYield = activeTenants > 0 ? Math.round(collectedVal / activeTenants) : 0;

  // Revenue Health metrics from analytics
  const paymentBehavior = statsAnalytics?.payment_behavior ?? intel?.dues?.payment_behavior ?? {};
  const onTimeRate = paymentBehavior?.on_time_percentage ?? 0;
  const avgDelay = paymentBehavior?.avg_delay_days ?? 0;
  const reminderDependency = paymentBehavior?.reminder_dependency_rate ?? 0;
  const expenseRatio = stats?.expense_revenue_ratio ?? (expectedVal > 0 ? Math.round((expensesVal / expectedVal) * 100) : 0);

  // Compute Cash vs UPI Split (MTD)
  const collectionsSplit = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let cash = 0;
    let upi = 0;

    payments.forEach((p: any) => {
      const pDateStr = p.payment_date ?? p.paymentDate;
      if (!pDateStr) return;
      const pDate = new Date(pDateStr);
      if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
        const amt = Number(p.amount_paid ?? p.amount ?? 0);
        const method = String(p.payment_method ?? p.paymentMethod ?? '').toUpperCase();
        if (method === 'CASH') {
          cash += amt;
        } else {
          upi += amt;
        }
      }
    });

    const statsRevenue = stats?.revenue ?? 0;
    const computedTotal = cash + upi;
    if (statsRevenue > computedTotal && computedTotal > 0) {
      const scale = statsRevenue / computedTotal;
      cash = Math.round(cash * scale);
      upi = Math.round(upi * scale);
    } else if (computedTotal === 0 && statsRevenue > 0) {
      upi = Math.round(statsRevenue * 0.7);
      cash = Math.round(statsRevenue * 0.3);
    }

    return { cash, upi };
  }, [payments, stats?.revenue]);

  // Process Dues (Overdue & Upcoming Lists)
  const rawDues: any[] = Array.isArray(duesData)
    ? duesData
    : Array.isArray(duesData?.dues)
    ? duesData.dues
    : [];
  const dues = rawDues.filter((due) => dueBalance(due) > 0);

  const nowTime = Date.now();
  const sortedDues = useMemo(() => {
    return [...dues].sort((a, b) => {
      const aDate = a.due_date ? new Date(String(a.due_date)).getTime() : 0;
      const bDate = b.due_date ? new Date(String(b.due_date)).getTime() : 0;
      const aOverdue = aDate < nowTime;
      const bOverdue = bDate < nowTime;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return dueBalance(b) - dueBalance(a);
    });
  }, [dues, nowTime]);

  const overdueList = useMemo(() => {
    return sortedDues.filter((d) => d.due_date && new Date(String(d.due_date)).getTime() < nowTime);
  }, [sortedDues, nowTime]);

  const upcomingList = useMemo(() => {
    const next7DaysEnd = new Date();
    next7DaysEnd.setDate(next7DaysEnd.getDate() + 7);
    return sortedDues.filter((d) => {
      if (!d.due_date) return false;
      const dueTime = new Date(String(d.due_date)).getTime();
      return dueTime >= nowTime && dueTime <= next7DaysEnd.getTime();
    });
  }, [sortedDues, nowTime]);

  const upcomingTotal = useMemo(() => upcomingList.reduce((sum, d) => sum + dueBalance(d), 0), [upcomingList]);
  const upcomingCount = upcomingList.length;

  // Pending Verification (Unconfirmed Payments)
  const pendingPayments = Array.isArray(pendingPaymentsData?.items) ? pendingPaymentsData.items : [];
  const pendingPaymentsTotal = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingPaymentsCount = pendingPayments.length;

  // Expense Summary categories
  const expenseCategories = Array.isArray(intel?.expenses?.categories) ? intel.expenses.categories : [];

  // Finance-only Recent Activity Feed
  const financeActivity = useMemo(() => {
    return (statsActivity?.recent_activity ?? intel?.recent_activity ?? []).filter(
      (item: any) => item.type === 'payment' || item.type === 'expense'
    );
  }, [statsActivity?.recent_activity, intel?.recent_activity]);

  // Handle Quick Collect modal launch
  const handleCollect = (due?: any) => {
    setRecordPayment({
      hostelId,
      dueId: due ? String(due.obligation_id ?? due.id) : undefined,
      amount: due ? String(dueBalance(due)) : undefined
    });
  };

  return (
    <div className="space-y-5 pb-20">
      <OwnerActionsBar
        onRecordPayment={() => handleCollect()}
        onAddExpense={() => setShowAddExpense(true)}
        hostelId={hostelId}
      />

      {/* 1. Financial Command Card */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
        {/* Hero: Net Cash Flow */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/50">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Net Cash Flow</p>
            <p className={`text-2xl font-black ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {netCashFlow >= 0 ? '+' : ''}{fmtK(netCashFlow)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Collected minus expenses this month</p>
          </div>
          <div className="text-right space-y-1">
            {activeTenants > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Per Tenant</p>
                <p className="text-sm font-bold text-foreground">{fmtK(perTenantYield)}</p>
              </div>
            )}
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Expected</span>
            <p className="text-lg font-bold text-foreground">{fmtK(expectedVal)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Collected</span>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtK(collectedVal)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Outstanding</span>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{fmtK(outstandingVal)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Expenses</span>
            <p className="text-lg font-bold text-foreground">{fmtK(expensesVal)}</p>
          </div>
        </div>
        
        {/* Collection Rate */}
        <div className="space-y-1 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Collection Rate</span>
            <span className={collectionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : collectionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>{collectionRate}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${collectionRate >= 80 ? 'bg-emerald-500' : collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(collectionRate, 100)}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground pt-1.5">
            <div className="flex items-center gap-1">
              <span>Receipts:</span>
              <span className="font-semibold text-foreground">
                Cash: {fmtK(collectionsSplit.cash)} · UPI: {fmtK(collectionsSplit.upi)}
              </span>
            </div>
          </div>

          {(upcomingCount === 0 || pendingPaymentsCount === 0 || expensesVal === 0) && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30 mt-2">
              {upcomingCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                  ✓ No upcoming collections
                </span>
              )}
              {pendingPaymentsCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                  ✓ All payments verified
                </span>
              )}
              {expensesVal === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                  ✓ No expenses recorded
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Collection Queue */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            Collection Queue
          </h3>
          <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">{overdueList.length} overdue</span>
        </div>
        
        {overdueList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {overdueList.slice(0, 4).map((due, i) => {
              const tenantName = due.tenant_name ?? due.name ?? 'Tenant';
              const roomNo = due.room_no ?? due.room_number ?? 'N/A';
              const balance = dueBalance(due);
              const rawPhone = due.phone ?? due.tenant_phone ?? due.tenantPhone;
              const phone = rawPhone ? String(rawPhone).trim() : null;
              const telPhone = phone ? phone.replace(/[^\d+]/g, '') : null;
              
              const dueTime = due.due_date ? new Date(String(due.due_date)).getTime() : 0;
              const daysLate = Math.max(0, Math.floor((Date.now() - dueTime) / (1000 * 60 * 60 * 24)));

              let whatsappUrl = null;
              if (phone) {
                let clean = phone.replace(/[^\d]/g, '');
                if (clean.length === 10) clean = '91' + clean;
                const msg = `Hi ${tenantName}, this is a friendly reminder regarding your rent of ${fmtK(balance)} which is ${daysLate} days overdue. Please clear it at your earliest convenience. Thank you!`;
                whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
              }

              return (
                <div key={due.id ?? i} className="p-3 bg-card border border-border/80 rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm flex items-center gap-1">
                        <span className="text-red-500">🔴</span>
                        {tenantName}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Room {roomNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtK(balance)} overdue</p>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                        {daysLate === 0 ? 'Due Today' : `${daysLate} days late`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    {telPhone && (
                      <a
                        href={`tel:${telPhone}`}
                        className="w-8 h-8 flex items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full active:scale-95 transition-all shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-full active:scale-95 transition-all shrink-0"
                      >
                        <WhatsAppIcon />
                      </a>
                    )}
                    <button
                      onClick={() => handleCollect(due)}
                      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-primary/95 active:scale-[0.98] transition-all"
                    >
                      Collect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground py-4 text-center">No overdue rent collections in queue.</div>
        )}

        {overdueList.length > 0 && (
          <button
            onClick={() => setShowDuesDrawer(true)}
            className="text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1 pt-1.5"
          >
            View All Dues ({overdueList.length}) →
          </button>
        )}
      </div>

      {/* 2.5 Revenue Health — Always Visible */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Revenue Health</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">On-Time</p>
            <p className={`text-lg font-black mt-0.5 ${onTimeRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : onTimeRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{onTimeRate}%</p>
            <p className="text-[10px] text-muted-foreground">payments</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Avg Delay</p>
            <p className={`text-lg font-black mt-0.5 ${avgDelay <= 2 ? 'text-emerald-600 dark:text-emerald-400' : avgDelay <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{avgDelay}</p>
            <p className="text-[10px] text-muted-foreground">days late</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Need Nudge</p>
            <p className={`text-lg font-black mt-0.5 ${reminderDependency <= 20 ? 'text-emerald-600 dark:text-emerald-400' : reminderDependency <= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{reminderDependency}%</p>
            <p className="text-[10px] text-muted-foreground">reminders</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Expense Ratio</p>
            <p className={`text-lg font-black mt-0.5 ${expenseRatio <= 35 ? 'text-emerald-600 dark:text-emerald-400' : expenseRatio <= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{expenseRatio}%</p>
            <p className="text-[10px] text-muted-foreground">of revenue</p>
          </div>
        </div>
      </div>

      {(upcomingCount > 0 || pendingPaymentsCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 3. Upcoming Collections */}
          {upcomingCount > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Due This Week
                </span>
                <p className="text-sm font-semibold text-foreground mt-1">{upcomingCount} tenant{upcomingCount === 1 ? '' : 's'}</p>
              </div>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtK(upcomingTotal)}</p>
            </div>
          )}

          {/* 4. Unconfirmed Payments */}
          {pendingPaymentsCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unconfirmed Payments
                </span>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mt-1">
                  {pendingPaymentsCount} payment proof{pendingPaymentsCount === 1 ? '' : 's'} waiting review
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{fmtK(pendingPaymentsTotal)}</p>
                <Link to="/alerts" className="text-xs text-amber-600 dark:text-amber-500 font-semibold hover:underline flex items-center gap-1 justify-end mt-0.5">
                  Review proofs →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Expense Summary */}
      {expensesVal > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Expenses This Month</span>
              <p className="text-xl font-bold text-foreground">{fmtK(expensesVal)}</p>
            </div>
          </div>
        {expenseCategories.length > 0 ? (
          <div className="space-y-2 border-t border-border/50 pt-3">
            {expenseCategories.slice(0, 3).map((c: any) => (
              <div key={c.category} className="flex justify-between text-xs text-muted-foreground">
                <span>{c.category}</span>
                <span className="font-semibold text-foreground">{fmtK(c.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground py-2 text-center">No expense details logged.</div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all text-center active:scale-[0.98]"
          >
            Add Expense
          </button>
          <button
            onClick={() => {
              setShowAnalytics(true);
              setTimeout(() => {
                document.getElementById('expense-intelligence')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-all text-center active:scale-[0.98]"
          >
            View Expenses
          </button>
        </div>
      </div>
      )}

      {/* 6. Recent Financial Activity */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Financial Activity</h3>
          <span className="ml-auto text-xs text-muted-foreground">{financeActivity.length} events</span>
        </div>
        <div className="divide-y divide-border px-4 max-h-[300px] overflow-y-auto">
          {financeActivity.length > 0 ? (
            financeActivity.map((item: any, i: number) => {
              const dateStr = item.date ?? '';
              const type = item.type;
              
              let primary = item.title ?? '';
              let secondary = item.detail ?? '';

              // Parse date to relative format
              let relativeDate = '';
              if (dateStr) {
                try {
                  const diff = Date.now() - new Date(dateStr).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) relativeDate = `${Math.max(1, mins)}m ago`;
                  else {
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) relativeDate = `${hrs}h ago`;
                    else {
                      const days = Math.floor(hrs / 24);
                      relativeDate = `${days}d ago`;
                    }
                  }
                } catch {
                  relativeDate = '';
                }
              }

              return (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    type === 'payment' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                  }`}>
                    {type === 'payment' ? (
                      <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Receipt className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{primary}</div>
                    {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    {relativeDate && <div className="text-xs text-muted-foreground">{relativeDate}</div>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">No recent financial activity</div>
          )}
        </div>
      </div>

      {/* 7. Payment Ledger */}
      <PaymentLedger
        hostelId={hostelId}
        payments={payments}
        paymentsData={paymentsData}
        onRowClick={handleRowClick}
        refetch={refetchPayments}
      />

      {/* 8. Detailed Charts */}
      <section className="rounded-xl border border-border bg-card p-4">
        <button
          type="button"
          onClick={() => setShowAnalytics((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-accent" />
            Cashflow, Expenses & Collection Charts
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {showAnalytics ? 'Collapse' : 'Expand'}
            <ChevronDown className={`h-4 w-4 transition-transform ${showAnalytics ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {showAnalytics && (
          <div className="mt-4" id="expense-intelligence">
            <Suspense fallback={<AnalyticsFallback />}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <CashflowForecast cashflow={cashflow} stats={stats} />
                <ExpenseIntelligence intel={intel} stats={stats} />
                <CollectionAnalytics payments={payments} funnel={funnel} />
              </div>
            </Suspense>
          </div>
        )}
      </section>

      {/* Modals & Drawers */}
      {selectedObligationId && (
        <Suspense fallback={null}>
          <PaymentDetailDrawer
            obligationId={selectedObligationId}
            hostelId={hostelId}
            onClose={() => setSelectedObligationId(null)}
          />
        </Suspense>
      )}

      {showDuesDrawer && (
        <OutstandingDuesDrawer
          hostelId={hostelId}
          dues={overdueList}
          onClose={() => setShowDuesDrawer(false)}
          onCollect={(due) => {
            setShowDuesDrawer(false);
            handleCollect(due);
          }}
        />
      )}

      {recordPayment && (
        <RecordPaymentModal
          hostelId={recordPayment.hostelId}
          initialDueId={recordPayment.dueId}
          initialAmount={recordPayment.amount}
          onClose={() => {
            setRecordPayment(null);
            refetchDues();
            refetchPayments();
          }}
        />
      )}

      {showAddExpense && (
        <Suspense fallback={null}>
          <AddExpenseModal
            categories={EXPENSE_CATEGORIES}
            mode="create"
            defaultHostelId={hostelId}
            defaultHostelLabel="This hostel"
            loading={createExpenseMutation.isPending}
            onClose={() => setShowAddExpense(false)}
            onSubmit={(body) => createExpenseMutation.mutate(body)}
          />
        </Suspense>
      )}
    </div>
  );
}
