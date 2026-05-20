import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
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

      <CollectionPipeline
        stats={stats}
        cashflow={cashflow}
        funnel={funnel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashflowForecast cashflow={cashflow} stats={stats} />
        <CollectionAnalytics payments={payments} funnel={funnel} />
      </div>

      <RiskZone intel={intel} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RoomPerformance intel={intel} stats={stats} />
        <ExpenseIntelligence intel={intel} stats={stats} />
      </div>

      {intel?.payment_attempts && (
        <PaymentAttemptsIntelligence attempts={intel.payment_attempts} />
      )}

      {intel?.recent_activity?.length > 0 && (
        <FinancialTimeline activity={intel.recent_activity} />
      )}

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
