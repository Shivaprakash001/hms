import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  TrendingUp,
  Percent,
  IndianRupee,
  RefreshCw,
} from 'lucide-react';
import { portfolioService } from '../../api/services';
import { queryKeys } from '../../lib/query/queryKeys';
import { OpsPage } from '@/components/ops/OpsPage';
import { OpsButton } from '@/components/ops/OpsButton';
import { OpsEmptyState } from '@/components/ops/OpsEmptyState';
import { OpsHostelCard } from '@/components/ops/OpsHostelCard';
import { OpsStatCard } from '@/components/dashboard/OpsStatCard';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState';
import { DashboardStatGridSkeleton } from '@/components/dashboard/DashboardSkeleton';

export default function Portfolio() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.portfolio.summary(),
    queryFn: portfolioService.getSummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const agg = data?.aggregate;
  const hostels = data?.hostels ?? [];

  if (isLoading) {
    return (
      <OpsPage title="Portfolio" eyebrow="Business control center">
        <DashboardStatGridSkeleton count={4} />
        <div className="h-40 bg-secondary rounded-xl animate-pulse mt-6" />
      </OpsPage>
    );
  }

  if (isError) {
    return (
      <DashboardErrorState
        message="Failed to load portfolio. Please refresh."
        onRetry={() => refetch()}
      />
    );
  }

  const refreshBtn = (
    <OpsButton
      variant="secondary"
      size="sm"
      onClick={() => refetch()}
      disabled={isFetching}
    >
      <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
      Refresh
    </OpsButton>
  );

  return (
    <OpsPage
      title="Portfolio overview"
      eyebrow={`${hostels.length} hostel${hostels.length !== 1 ? 's' : ''} · live snapshots`}
      actions={refreshBtn}
      contentClassName="space-y-6 ops-main-pad-bottom"
    >
      {agg && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <OpsStatCard
            label="Active tenants"
            value={agg.active_tenants}
            subtitle={`${agg.vacant_beds} vacant beds`}
            icon={Users}
          />
          <OpsStatCard
            label="Occupancy"
            value={`${agg.occupancy_rate.toFixed(1)}%`}
            subtitle={`${agg.total_capacity} capacity`}
            icon={Percent}
            tone="success"
          />
          <OpsStatCard
            label="Collected"
            value={`₹${(agg.rent_collected_this_month / 1000).toFixed(1)}K`}
            subtitle={`${agg.collection_rate.toFixed(1)}% rate`}
            icon={IndianRupee}
            tone="success"
          />
          <OpsStatCard
            label="Pending dues"
            value={`₹${(agg.pending_dues / 1000).toFixed(1)}K`}
            subtitle={`${agg.overdue_count} overdue`}
            icon={TrendingUp}
            tone={agg.overdue_count > 0 ? 'danger' : 'warning'}
            highlight={agg.overdue_count > 0}
          />
        </div>
      )}

      <DashboardSection
        title="Hostels"
        description="Select a property to manage collections and occupancy"
      >
        {hostels.length === 0 ? (
          <OpsEmptyState
            icon={Building2}
            title="No active hostels"
            description="Hostels in your portfolio will appear here with occupancy and dues."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {hostels.map((hostel) => (
              <OpsHostelCard key={hostel.hostel_id} hostel={hostel} />
            ))}
          </div>
        )}
      </DashboardSection>

      {data?.computed_at && (
        <p className="text-center text-[10px] text-muted-foreground">
          Computed at {new Date(data.computed_at).toLocaleString()}
        </p>
      )}
    </OpsPage>
  );
}
