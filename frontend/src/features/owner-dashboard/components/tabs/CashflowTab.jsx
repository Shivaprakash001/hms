import React from 'react';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Bell, CheckCircle2, Clock,
  CreditCard, ShieldAlert, Target, Users, Wallet,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SmartDashboardGuidance from '@components/SmartDashboardGuidance';
import { formatCurrency } from '@utils/format';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { OpsStatCard } from '@/components/dashboard/OpsStatCard';
import { DashboardCard, DashboardCardHeader } from '@/components/dashboard/DashboardCard';
import { InsightStrip } from '@/components/dashboard/InsightStrip';
import { ReminderButton } from '../ReminderButton';
import { dAmt, dDays, dId, dName, riskBadge, RISK_CLASSES } from '../../utils/defaulterHelpers';

export function CashflowTab({
  cfStats,
  cfSeverity,
  cfInsights,
  preferences,
  navigate,
  opPath,
  onOpenTestPayment,
  riskyTenantCount = 0,
  onViewRisky,
}) {
  const isNewOwner = cfStats.expected === 0 && cfStats.topDefaulters.length === 0;
  if (isNewOwner) return <SmartDashboardGuidance />;

  const highRisk = cfStats.topDefaulters.filter((d) => riskBadge(d) === 'HIGH').length;
  const actionItems = [
    cfStats.overdueCount > 0 && {
      id: 'remind',
      icon: Bell,
      tone: 'text-ops-accent',
      label: `${cfStats.overdueCount} unpaid dues`,
      desc: 'Review and send reminders',
      path: null,
    },
    highRisk > 0 && {
      id: 'high',
      icon: ShieldAlert,
      tone: 'text-ops-danger',
      label: `${highRisk} critical defaulters`,
      desc: 'Overdue 10+ days',
      path: opPath('tenants'),
    },
    cfStats.pending > 0 && {
      id: 'collect',
      icon: Wallet,
      tone: 'text-ops-success',
      label: 'Collectible revenue',
      desc: formatCurrency(cfStats.pending, preferences),
      path: opPath('financials'),
    },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Operations control"
        title="Revenue overview"
        actions={
          <>
            <button
              type="button"
              onClick={onOpenTestPayment}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ops-accent/30 bg-ops-accent/10 text-xs font-medium text-ops-accent active:scale-[0.98]"
            >
              <CreditCard size={14} />
              Test payment
            </button>
            <button
              type="button"
              onClick={() => navigate(opPath('financials'))}
              className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground active:scale-[0.98]"
              aria-label="Open payments"
            >
              <ArrowUpRight size={18} />
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <OpsStatCard
          label="Expected"
          value={formatCurrency(cfStats.expected, preferences)}
          subtitle="Monthly goal"
          icon={Target}
          onClick={() => navigate(opPath('financials'))}
        />
        <OpsStatCard
          label="Collected"
          value={formatCurrency(cfStats.collected, preferences)}
          subtitle={`${cfStats.rate.toFixed(1)}% collection rate`}
          icon={CheckCircle2}
          tone="success"
          onClick={() => navigate(opPath('financials'))}
        />
        <OpsStatCard
          label="Pending"
          value={formatCurrency(cfStats.pending, preferences)}
          subtitle={`${cfStats.overdueCount} tenants`}
          icon={Clock}
          highlight={cfStats.pending > 0}
          onClick={() => navigate(opPath('financials'))}
        />
        <OpsStatCard
          label="Overdue"
          value={formatCurrency(cfStats.overdueAmt, preferences)}
          subtitle="Past due date"
          icon={AlertTriangle}
          tone={cfStats.overdueAmt > 0 ? 'danger' : 'default'}
          onClick={() => navigate(opPath('financials'))}
        />
      </div>

      {riskyTenantCount > 0 && (
        <DashboardCard className="p-4 border-l-4 border-l-ops-danger">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <Users size={18} className="text-ops-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {riskyTenantCount} high-risk tenant{riskyTenantCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">Behavior score below 50 — review recommended</p>
            </div>
            {onViewRisky && (
              <button
                type="button"
                onClick={onViewRisky}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ops-danger/30 bg-red-50 text-xs font-medium text-ops-danger hover:bg-red-100 transition-colors active:scale-[0.98]"
              >
                Review
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </DashboardCard>
      )}

      {cfStats.topDefaulters.length > 0 && (
        <DashboardSection
          title="Critical dues"
          description={`${cfStats.topDefaulters.length} tenants need follow-up`}
        >
          <DashboardCard className="overflow-hidden">
            <DashboardCardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-ops-danger" />
                <span className="text-sm font-medium text-foreground">Top defaulters</span>
              </div>
            </DashboardCardHeader>
            <div className="divide-y divide-border">
              {cfStats.topDefaulters.map((d) => {
                const risk = riskBadge(d);
                return (
                  <div key={dId(d)} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${RISK_CLASSES[risk]}`}
                        >
                          {risk}
                        </span>
                        <p className="text-sm font-medium text-foreground truncate">{dName(d)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-foreground">
                          {formatCurrency(dAmt(d), preferences)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dDays(d)} days overdue
                        </span>
                      </div>
                    </div>
                    <ReminderButton
                      tenantId={dId(d)}
                      onNoCredits={() => navigate('/dashboard/billing')}
                    />
                  </div>
                );
              })}
            </div>
          </DashboardCard>
        </DashboardSection>
      )}

      {actionItems.length > 0 && (
        <DashboardSection title="Priority actions">
          <DashboardCard className="p-4 space-y-3">
            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${item.tone}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  {item.path && (
                    <button
                      type="button"
                      onClick={() => navigate(item.path)}
                      className="p-2 rounded-lg bg-secondary hover:bg-ops-accent/10 text-muted-foreground hover:text-ops-accent transition-colors"
                    >
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </DashboardCard>
        </DashboardSection>
      )}

      {cfStats.daily.length > 0 && (
        <DashboardCard className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Collection trend</p>
              <h3 className="text-sm font-medium text-foreground">Daily revenue</h3>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(cfStats.daily[cfStats.daily.length - 1]?.v ?? 0, preferences)}
              </p>
              <p className="text-[10px] text-ops-success font-medium">Latest day</p>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cfStats.daily}>
                <defs>
                  <linearGradient id="opsColorV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                  }}
                  formatter={(value) => formatCurrency(value, preferences)}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  fill="url(#opsColorV)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      )}

      <InsightStrip insights={cfInsights} severity={cfSeverity} />
    </div>
  );
}
