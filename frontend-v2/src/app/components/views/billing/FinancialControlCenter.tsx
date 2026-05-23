import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronDown } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { OwnerActionsBar } from './OwnerActionsBar';
import { TodayPriorities } from './TodayPriorities';
import { HealthBar } from './HealthBar';
import { CashPosition } from './CashPosition';
import { CollectionPipeline } from './CollectionPipeline';
import { CashflowForecast } from './CashflowForecast';
import { CollectionAnalytics } from './CollectionAnalytics';
import { RiskZone } from './RiskZone';
import { RoomPerformance } from './RoomPerformance';
import { ExpenseIntelligence } from './ExpenseIntelligence';
import { PaymentAttemptsIntelligence } from './PaymentAttemptsIntelligence';
import { FinancialTimeline } from './FinancialTimeline';
import { PaymentLedger } from './PaymentLedger';
import { PaymentDetailDrawer } from './PaymentDetailDrawer';

interface Props {
  hostelId: string;
  onRecordPayment?: () => void;
  onAddExpense?: () => void;
}

export function FinancialControlCenter({ hostelId, onRecordPayment, onAddExpense }: Props) {
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(hostelId),
    queryFn: () => import('@features/dashboard/api').then((m) => m.dashboardService.getStats(hostelId)),
    staleTime: 2 * 60 * 1000,
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

  const handleRowClick = useCallback((id: string) => setSelectedObligationId(id), []);

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

      <RoomPerformance intel={intel} stats={stats} />

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
        <PaymentDetailDrawer
          obligationId={selectedObligationId}
          hostelId={hostelId}
          onClose={() => setSelectedObligationId(null)}
        />
      )}
    </div>
  );
}
