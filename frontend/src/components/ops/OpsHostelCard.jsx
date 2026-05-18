import React from 'react';
import { Building2, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ProgressTrack } from '@/components/dashboard/ProgressTrack';

function occupancyTone(rate) {
  if (rate >= 90) return 'text-ops-success';
  if (rate >= 75) return 'text-ops-warning';
  return 'text-ops-danger';
}

export function OpsHostelCard({ hostel }) {
  const navigate = useNavigate();
  const occ = hostel.occupancy_rate ?? 0;

  return (
    <DashboardCard
      className="p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer hover:border-ops-accent/30"
      onClick={() => navigate(`/dashboard/${hostel.hostel_id}/overview`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/dashboard/${hostel.hostel_id}/overview`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-ops-accent/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-ops-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{hostel.name}</h3>
            {hostel.city && (
              <p className="text-xs text-muted-foreground truncate">{hostel.city}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/dashboard/${hostel.hostel_id}/overview`);
          }}
          className="flex items-center gap-1 text-xs font-medium text-ops-accent shrink-0"
        >
          Manage <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Occupancy</span>
          <span className={cn('font-semibold', occupancyTone(occ))}>{occ.toFixed(1)}%</span>
        </div>
        <ProgressTrack value={occ} />
        <p className="text-[10px] text-muted-foreground mt-1">
          {hostel.active_tenants} / {hostel.total_capacity} beds · {hostel.collection_rate?.toFixed(1)}% collected
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
        <div>
          <p className="text-[10px] text-muted-foreground">Collected</p>
          <p className="text-sm font-semibold text-ops-success">
            ₹{(hostel.collected_revenue / 1000).toFixed(1)}K
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Pending</p>
          <p
            className={cn(
              'text-sm font-semibold',
              hostel.pending_dues > 0 ? 'text-ops-danger' : 'text-muted-foreground',
            )}
          >
            {hostel.pending_dues > 0 ? `₹${(hostel.pending_dues / 1000).toFixed(1)}K` : '—'}
          </p>
          {hostel.overdue_count > 0 && (
            <p className="text-[10px] text-ops-danger">{hostel.overdue_count} overdue</p>
          )}
        </div>
      </div>

      {hostel.is_stale && (
        <p className="text-[10px] text-ops-warning flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Snapshot may be stale
        </p>
      )}
    </DashboardCard>
  );
}
