import React from 'react';
import { Activity, Home } from 'lucide-react';
import { formatCurrency } from '@utils/format';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { OpsStatCard } from '@/components/dashboard/OpsStatCard';
import { InsightStrip } from '@/components/dashboard/InsightStrip';
import { DashboardTabSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { ProgressTrack } from '@/components/dashboard/ProgressTrack';

function MessageSquareIcon({ size, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function OperationsTab({ data, severity, insights, loading, preferences, navigate, opPath }) {
  if (loading || !data) return <DashboardTabSkeleton />;

  const occ = Number(data.occupancy_rate ?? 0);
  const rev = Number(data.revenue ?? 0);
  const exp = Number(data.expenses ?? 0);
  const profit = Number(data.profit ?? 0);
  const vacant =
    occ > 0
      ? Math.max(
          0,
          Math.round((Number(data.occupied_rooms) * 100) / occ) - Number(data.occupied_rooms),
        )
      : 0;

  const occColor =
    occ >= 90 ? 'bg-ops-success' : occ >= 75 ? 'bg-ops-warning' : 'bg-ops-danger';

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Property status"
        title="Operations"
        actions={
          <button
            type="button"
            onClick={() => navigate(opPath('rooms'))}
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <Home size={18} />
          </button>
        }
      />

      <DashboardCard className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Occupancy rate</p>
            <p className="text-4xl font-semibold text-foreground tracking-tight">{occ.toFixed(1)}%</p>
          </div>
          {vacant > 0 && (
            <div className="text-center px-3 py-2 rounded-lg bg-ops-warning/10 border border-ops-warning/20">
              <p className="text-xl font-semibold text-ops-warning">{vacant}</p>
              <p className="text-[10px] text-muted-foreground">Vacant</p>
            </div>
          )}
        </div>
        <ProgressTrack value={occ} barClassName={occColor} className="h-2 mb-4" />
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
          <div>
            <p className="text-lg font-semibold text-ops-success">+{data.move_ins || 0}</p>
            <p className="text-[10px] text-muted-foreground">Move in</p>
          </div>
          <div className="border-x border-border">
            <p className="text-lg font-semibold text-ops-danger">-{data.move_outs || 0}</p>
            <p className="text-[10px] text-muted-foreground">Move out</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{data.total_rooms || 0}</p>
            <p className="text-[10px] text-muted-foreground">Rooms</p>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-4 space-y-4">
        <p className="text-sm font-medium text-foreground">P&L performance</p>
        {[
          { label: 'Revenue', value: rev, color: 'bg-ops-success' },
          { label: 'Expenses', value: exp, color: 'bg-ops-danger' },
          { label: 'Profit', value: profit, color: 'bg-ops-accent' },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground">
                {formatCurrency(row.value, preferences)}
              </span>
            </div>
            <ProgressTrack
              value={rev > 0 ? (row.value / rev) * 100 : 0}
              barClassName={row.color}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => navigate(opPath('expenses'))}
          className="w-full py-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary active:scale-[0.98] transition-transform"
        >
          View expense audit
        </button>
      </DashboardCard>

      <div className="grid grid-cols-2 gap-3">
        <OpsStatCard
          label="Complaints"
          value={data.complaints?.pending || 0}
          icon={MessageSquareIcon}
        />
        <OpsStatCard label="Maintenance" value="Active" icon={Activity} />
      </div>

      <InsightStrip insights={insights} severity={severity} />
    </div>
  );
}
