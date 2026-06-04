import { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronDown } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { OwnerActionsBar } from './OwnerActionsBar';
import { TodayPriorities } from './TodayPriorities';
import { HealthBar } from './HealthBar';
import { CashPosition } from './CashPosition';
import { RiskZone } from './RiskZone';

import { PaymentLedger } from './PaymentLedger';

const CollectionPipeline = lazy(() => import('./CollectionPipeline').then((m) => ({ default: m.CollectionPipeline })));
const CashflowForecast = lazy(() => import('./CashflowForecast').then((m) => ({ default: m.CashflowForecast })));
const CollectionAnalytics = lazy(() => import('./CollectionAnalytics').then((m) => ({ default: m.CollectionAnalytics })));
const ExpenseIntelligence = lazy(() => import('./ExpenseIntelligence').then((m) => ({ default: m.ExpenseIntelligence })));
const PaymentAttemptsIntelligence = lazy(() => import('./PaymentAttemptsIntelligence').then((m) => ({ default: m.PaymentAttemptsIntelligence })));
const FinancialTimeline = lazy(() => import('./FinancialTimeline').then((m) => ({ default: m.FinancialTimeline })));
const PaymentDetailDrawer = lazy(() => import('./PaymentDetailDrawer').then((m) => ({ default: m.PaymentDetailDrawer })));

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

export function FinancialControlCenter({ hostelId, onRecordPayment, onAddExpense }: Props) {
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

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
    enabled: !!hostelId && showAnalytics,
  });

  const { data: statsActivity } = useQuery({
    queryKey: queryKeys.dashboard.statsActivity(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getStatsActivity(hostelId)),
    staleTime: 60 * 1000,
    enabled: !!hostelId && showAnalytics,
  });

  const { data: cashflow } = useQuery({
    queryKey: queryKeys.dashboard.cashflow(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getCashflow(hostelId)),
    staleTime: 3 * 60 * 1000,
    enabled: !!hostelId && showAnalytics,
  });

  const { data: funnel } = useQuery({
    queryKey: queryKeys.dashboard.funnel(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getFunnel(hostelId)),
    staleTime: 5 * 60 * 1000,
    enabled: !!hostelId && showAnalytics,
  });

  const { data: paymentsData, refetch: refetchPayments } = useQuery({
    queryKey: queryKeys.payments.ledger(hostelId, { limit: 40 }),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAll(hostelId, { limit: 40 })),
    staleTime: 2 * 60 * 1000,
    enabled: !!hostelId,
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

  return (
    <div className="space-y-5 pb-20">
      <OwnerActionsBar
        onRecordPayment={onRecordPayment}
        onAddExpense={onAddExpense}
        hostelId={hostelId}
      />

      {intel?.alerts?.length > 0 && (
        <TodayPriorities alerts={intel.alerts} attempts={intel.payment_attempts} />
      )}

      <HealthBar stats={stats} loading={statsLoading} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CashPosition stats={stats} />
      </div>

      <RiskZone intel={intel} />



      <section className="rounded-xl border border-border bg-card p-4">
        <button
          type="button"
          onClick={() => setShowAnalytics((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-accent" />
            Analytics and forecast
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {showAnalytics ? 'Hide details' : 'View details'}
            <ChevronDown className={`h-4 w-4 transition-transform ${showAnalytics ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {showAnalytics && (
          <div className="mt-4 space-y-4">
            <Suspense fallback={<AnalyticsFallback />}>
              <CollectionPipeline
                stats={stats}
                cashflow={cashflow}
                funnel={funnel}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CashflowForecast cashflow={cashflow} stats={stats} />
                <CollectionAnalytics payments={payments} funnel={funnel} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ExpenseIntelligence intel={intel} stats={stats} />
                {intel?.payment_attempts ? (
                  <PaymentAttemptsIntelligence attempts={intel.payment_attempts} />
                ) : null}
              </div>

              {intel?.recent_activity?.length > 0 && (
                <FinancialTimeline activity={intel.recent_activity} />
              )}
            </Suspense>
          </div>
        )}
      </section>

      <PaymentLedger
        hostelId={hostelId}
        payments={payments}
        paymentsData={paymentsData}
        onRowClick={handleRowClick}
        refetch={refetchPayments}
      />

      {selectedObligationId && (
        <Suspense fallback={null}>
          <PaymentDetailDrawer
            obligationId={selectedObligationId}
            hostelId={hostelId}
            onClose={() => setSelectedObligationId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
