import React from 'react';
import { Target, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@utils/format';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { OpsStatCard } from '@/components/dashboard/OpsStatCard';
import { InsightStrip } from '@/components/dashboard/InsightStrip';
import { DashboardTabSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { ProgressTrack } from '@/components/dashboard/ProgressTrack';

export function FunnelTab({ data, severity, insights, loading, preferences, navigate, opPath }) {
  if (loading || !data) return <DashboardTabSkeleton />;

  const sent = data.reminders_sent ?? 0;
  const rate = Number(data.conversion_rate ?? 0);
  const revenue = Number(data.revenue_generated ?? 0);
  const channels = data.channel_performance ?? [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Pipeline"
        title="Reminder funnel"
        actions={
          <button
            type="button"
            onClick={() => navigate(opPath('financials'))}
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <Target size={18} />
          </button>
        }
      />

      <DashboardCard className="p-4 bg-foreground text-background border-foreground">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-xs text-background/60 mb-1">Conversion rate</p>
            <p className="text-4xl font-semibold tracking-tight">{rate.toFixed(1)}%</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-background/10 flex items-center justify-center text-ops-accent">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-background/60 mb-1.5">
              <span>Reminders sent</span>
              <span>{sent}</span>
            </div>
            <ProgressTrack value={100} barClassName="bg-ops-accent" className="bg-background/15 h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-background/60 mb-1.5">
              <span>Payments received</span>
              <span>{data.conversions}</span>
            </div>
            <ProgressTrack value={rate} barClassName="bg-ops-success" className="bg-background/15 h-2" />
          </div>
        </div>
      </DashboardCard>

      <div className="grid grid-cols-2 gap-3">
        <OpsStatCard
          label="Automated revenue"
          value={formatCurrency(revenue, preferences)}
          subtitle="Via reminders"
          tone="success"
        />
        <OpsStatCard
          label="Avg pay time"
          value={`${data.avg_time_to_pay_hours?.toFixed(1) ?? 0}h`}
          subtitle="Post alert"
          tone="accent"
        />
      </div>

      {channels.length > 0 && (
        <DashboardCard className="p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Channel efficiency</p>
          {channels.map((ch, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground w-16 uppercase">
                {ch.channel}
              </span>
              <ProgressTrack value={ch.conversion_rate} className="flex-1" />
              <span className="text-xs font-semibold text-foreground w-10 text-right">
                {ch.conversion_rate.toFixed(0)}%
              </span>
            </div>
          ))}
        </DashboardCard>
      )}

      <InsightStrip insights={insights} severity={severity} />
    </div>
  );
}
