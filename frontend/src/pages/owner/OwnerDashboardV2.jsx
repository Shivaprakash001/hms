import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Target, Users, Wallet } from 'lucide-react';
import FirstSuccessMoment from '@components/FirstSuccessMoment';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import { useHostelContext } from '@/context/HostelContext';
import {
  useCashflow,
  useFunnelAnalytics,
  useOperationsAnalytics,
  useTenantAnalytics,
} from '@hooks/useAnalytics';
import { DashboardAlertBanner } from '@/components/dashboard/DashboardAlertBanner';
import { DashboardTabBar } from '@/components/dashboard/DashboardTabBar';
import { DashboardPageSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState';
import { CashflowTab } from '@/features/owner-dashboard/components/tabs/CashflowTab';
import { TenantsTab } from '@/features/owner-dashboard/components/tabs/TenantsTab';
import { FunnelTab } from '@/features/owner-dashboard/components/tabs/FunnelTab';
import { OperationsTab } from '@/features/owner-dashboard/components/tabs/OperationsTab';
import { TestPaymentModal } from '@/features/owner-dashboard/components/TestPaymentModal';

const TABS = [
  { id: 'cashflow', label: 'Revenue', Icon: Wallet },
  { id: 'tenants', label: 'Tenants', Icon: Users },
  { id: 'funnel', label: 'Funnel', Icon: Target },
  { id: 'operations', label: 'Ops', Icon: Home },
];

export default function OwnerDashboardV2() {
  const navigate = useNavigate();
  const { hostelId, activeHostel } = useHostelContext();
  const { preferences } = useAppPreferences();
  const [tab, setTab] = useState('cashflow');
  const [dismissed, setDismissed] = useState(false);
  const [showTestPayment, setShowTestPayment] = useState(false);
  const [milestoneNotifs, setMilestoneNotifs] = useState([]);

  const opPath = (section) => `/dashboard/${hostelId}/${section}`;

  useEffect(() => {
    import('../../api/services').then(({ notificationService }) => {
      notificationService
        .getAll()
        .then((data) => {
          const notifs = Array.isArray(data) ? data : data?.notifications ?? [];
          setMilestoneNotifs(notifs.filter((n) => !n.is_read));
        })
        .catch(() => {});
    });
  }, []);

  const handleMilestoneDismiss = (notifId) => {
    setMilestoneNotifs((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n)),
    );
    import('../../api/services').then(({ notificationService }) => {
      notificationService.markAsRead(notifId).catch(() => {});
    });
  };

  const {
    data: cf,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useCashflow(hostelId);
  const { data: ti, isLoading: tiLoading } = useTenantAnalytics(
    hostelId,
    undefined,
    tab === 'tenants',
  );
  const { data: fn, isLoading: fnLoading } = useFunnelAnalytics(
    hostelId,
    undefined,
    tab === 'funnel',
  );
  const { data: op, isLoading: opLoading } = useOperationsAnalytics(
    hostelId,
    undefined,
    tab === 'operations',
  );

  const cfd = cf?.data ?? {};
  const cfStats = useMemo(
    () => ({
      expected: Number(cfd.expected_rent ?? 0),
      collected: Number(cfd.collected_amount ?? 0),
      pending: Number(cfd.pending_amount ?? 0),
      rate: Number(cfd.collection_rate ?? 0),
      overdueAmt: Number(cfd.overdue_amount ?? 0),
      overdueCount: Number(cfd.overdue_tenants_count ?? 0),
      topDefaulters: Array.isArray(cfd.top_defaulters) ? cfd.top_defaulters : [],
      daily: Array.isArray(cfd.daily_collection)
        ? cfd.daily_collection.map((r) => ({
            label: r.date?.slice(5),
            v: Number(r.amount),
          }))
        : [],
    }),
    [cfd],
  );

  const showBanner = !dismissed && cfStats.overdueCount > 0;
  const hostelName = activeHostel?.name;

  if (isLoading && !cf) {
    return <DashboardPageSkeleton />;
  }

  if (isError) {
    return (
      <DashboardErrorState
        message="Failed to load dashboard. Check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="relative pb-20 min-h-screen bg-ops-surface">
      <FirstSuccessMoment
        notifications={milestoneNotifs}
        onDismiss={handleMilestoneDismiss}
      />

      {showBanner && (
        <DashboardAlertBanner
          title="Unpaid dues detected"
          message={`${cfStats.overdueCount} tenant${cfStats.overdueCount !== 1 ? 's' : ''} unpaid this month · ${hostelName || 'This hostel'}`}
          severity={cfStats.overdueCount > 5 ? 'critical' : 'warning'}
          onDismiss={() => setDismissed(true)}
          onAction={() => setTab('tenants')}
          actionLabel="View defaulters"
        />
      )}

      <div className="px-4 pt-4 sm:pt-6 space-y-6 max-w-3xl mx-auto">
        {isFetching && cf && (
          <p className="text-[10px] text-muted-foreground text-center">Refreshing…</p>
        )}

        <AnimatePresence mode="wait">
          {tab === 'cashflow' && (
            <motion.div
              key="cashflow"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <CashflowTab
                cfStats={cfStats}
                cfSeverity={cf?.severity}
                cfInsights={cf?.insights ?? []}
                preferences={preferences}
                navigate={navigate}
                opPath={opPath}
                onOpenTestPayment={() => setShowTestPayment(true)}
              />
            </motion.div>
          )}
          {tab === 'tenants' && (
            <motion.div
              key="tenants"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <TenantsTab
                data={ti?.data}
                severity={ti?.severity}
                insights={ti?.insights ?? []}
                loading={tiLoading}
                preferences={preferences}
                navigate={navigate}
                opPath={opPath}
              />
            </motion.div>
          )}
          {tab === 'funnel' && (
            <motion.div
              key="funnel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <FunnelTab
                data={fn?.data}
                severity={fn?.severity}
                insights={fn?.insights ?? []}
                loading={fnLoading}
                preferences={preferences}
                navigate={navigate}
                opPath={opPath}
              />
            </motion.div>
          )}
          {tab === 'operations' && (
            <motion.div
              key="operations"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <OperationsTab
                data={op?.data}
                severity={op?.severity}
                insights={op?.insights ?? []}
                loading={opLoading}
                preferences={preferences}
                navigate={navigate}
                opPath={opPath}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DashboardTabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        badge={cfStats.overdueCount}
      />

      <TestPaymentModal
        isOpen={showTestPayment}
        onClose={() => setShowTestPayment(false)}
        hostelId={hostelId}
        preferences={preferences}
      />
    </div>
  );
}
