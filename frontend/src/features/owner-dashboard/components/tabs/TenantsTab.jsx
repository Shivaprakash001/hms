import React from 'react';
import { Users } from 'lucide-react';
import { formatCurrency } from '@utils/format';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { OpsStatCard } from '@/components/dashboard/OpsStatCard';
import { InsightStrip } from '@/components/dashboard/InsightStrip';
import { DashboardTabSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { ReminderButton } from '../ReminderButton';

export function TenantsTab({ data, severity, insights, loading, preferences, navigate, opPath }) {
  if (loading || !data) return <DashboardTabSkeleton />;

  const dist = data.distribution ?? { good: 0, medium: 0, risky: 0 };
  const risky = data.risky_tenants ?? [];
  const beh = data.payment_behavior ?? {};
  const total = dist.good + dist.medium + dist.risky || 1;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Member insights"
        title="Tenant health"
        actions={
          <button
            type="button"
            onClick={() => navigate(opPath('tenants'))}
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Manage tenants"
          >
            <Users size={18} />
          </button>
        }
      />

      <DashboardCard className="p-4">
        <p className="text-xs text-muted-foreground mb-3">Health distribution</p>
        <div className="flex h-3 gap-0.5 mb-4 rounded-full overflow-hidden">
          {dist.good > 0 && (
            <div
              className="bg-ops-success"
              style={{ width: `${(dist.good / total) * 100}%` }}
              title={`Stable ${dist.good}`}
            />
          )}
          {dist.medium > 0 && (
            <div
              className="bg-ops-warning"
              style={{ width: `${(dist.medium / total) * 100}%` }}
              title={`Watch ${dist.medium}`}
            />
          )}
          {dist.risky > 0 && (
            <div
              className="bg-ops-danger"
              style={{ width: `${(dist.risky / total) * 100}%` }}
              title={`At risk ${dist.risky}`}
            />
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-semibold text-ops-success">{dist.good}</p>
            <p className="text-[10px] text-muted-foreground">Stable</p>
          </div>
          <div className="border-x border-border">
            <p className="text-lg font-semibold text-ops-warning">{dist.medium}</p>
            <p className="text-[10px] text-muted-foreground">Watch</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-ops-danger">{dist.risky}</p>
            <p className="text-[10px] text-muted-foreground">At risk</p>
          </div>
        </div>
      </DashboardCard>

      <div className="grid grid-cols-3 gap-3">
        <OpsStatCard
          label="On-time"
          value={`${beh.on_time_percentage ?? 0}%`}
          tone="success"
        />
        <OpsStatCard
          label="Avg delay"
          value={`${Math.round(beh.avg_delay_days ?? 0)}d`}
          tone="warning"
        />
        <OpsStatCard
          label="Reminder dep."
          value={`${beh.reminder_dependency_rate ?? 0}%`}
          tone="accent"
        />
      </div>

      {risky.length > 0 && (
        <DashboardSection title="Risk mitigation" description={`${risky.length} tenants flagged`}>
          <DashboardCard className="overflow-hidden divide-y divide-border">
            {risky.map((t) => (
              <div key={t.tenant_id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Score {t.score} · {formatCurrency(t.pending_amount, preferences)} due
                  </p>
                </div>
                <ReminderButton
                  tenantId={t.tenant_id}
                  onNoCredits={() => navigate('/dashboard/billing')}
                />
              </div>
            ))}
          </DashboardCard>
        </DashboardSection>
      )}

      <InsightStrip insights={insights} severity={severity} />
    </div>
  );
}
