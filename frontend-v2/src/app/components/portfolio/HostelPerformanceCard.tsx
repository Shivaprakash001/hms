import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Trophy, AlertCircle } from 'lucide-react';
import { HostelStatusBadge, type HostelStatus } from '../hostel/HostelStatusBadge';
import { HostelActionMenu } from '../hostel/HostelActionMenu';

const fmt = (n: number) => {
  const v = Number(n ?? 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

export interface HostelRanking {
  hostel_id: string;
  hostel_name: string;
  city?: string | null;
  status?: string;
  archived_at?: string | null;
  archive_reason?: string | null;
  revenue: number;
  occupancy_rate: number;
  collection_rate: number;
  pending_dues: number;
  active_tenants?: number;
  occupied_beds?: number;
  total_capacity?: number;
  vacant_beds?: number;
  trend_percentage: number;
  is_top_performer?: boolean;
}

interface Props {
  hostel: HostelRanking;
  rank: number;
  onEdit?: (hostelId: string) => void;
  onPause?: (hostelId: string, hostelName: string) => void;
  onClose?: (hostelId: string, hostelName: string) => void;
  onResume?: (hostelId: string, hostelName: string) => void;
  onRestore?: (hostelId: string, hostelName: string) => void;
}

function BedsLabel({ active, capacity, vacant }: { active: number; capacity: number; vacant: number }) {
  if (capacity === 0 || isNaN(capacity)) return <span className="text-muted-foreground">0</span>;
  if (vacant === 0)
    return <span className="font-semibold text-success text-sm">Full · {active}/{capacity}</span>;
  return (
    <span className="text-sm">
      <span className="font-semibold text-foreground">{active}/{capacity}</span>
      <span className="text-xs text-amber-600 font-medium ml-1">· {vacant} vacant</span>
    </span>
  );
}

function DuesLabel({ amount }: { amount: number }) {
  if (amount <= 0)
    return <span className="text-xs font-medium text-success">All clear</span>;
  return (
    <span className="text-xs font-semibold text-destructive">{fmt(amount)} due</span>
  );
}

function HostelPerformanceCardComponent({ hostel, rank, onEdit, onPause, onClose, onResume, onRestore }: Props) {
  const navigate = useNavigate();
  const detailHostelId = String(
    hostel.hostel_id || (hostel as unknown as { id?: string }).id || ''
  );

  const status = (hostel.status as HostelStatus) || 'ACTIVE';
  const isArchived = status === 'ARCHIVED';
  const isInactive = status === 'INACTIVE';

  const activeTenants = Number(hostel.active_tenants ?? 0);
  const occupiedBeds = Number(hostel.occupied_beds ?? activeTenants);
  const totalCapacity = Number(hostel.total_capacity ?? 0);
  const vacantBeds = Number(hostel.vacant_beds ?? 0);
  const hasAlert = !isArchived && (hostel.pending_dues > 0 || vacantBeds > 0);

  const openDetail = () => {
    if (detailHostelId) navigate(`/hostels/${detailHostelId}`);
  };

  // Card styling per status
  const cardBorder = isArchived
    ? 'border-l-4 border-l-slate-300 dark:border-l-slate-600 opacity-60'
    : isInactive
    ? 'border-l-4 border-l-amber-400 dark:border-l-amber-500 opacity-80'
    : '';

  const ctaLabel = isArchived ? 'View Records' : 'Manage Property';

  return (
    <div
      role="button"
      tabIndex={detailHostelId ? 0 : -1}
      onClick={detailHostelId ? openDetail : undefined}
      onKeyDown={(e) => {
        if (detailHostelId && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openDetail();
        }
      }}
      aria-label={`${isArchived ? 'View' : 'Manage'} ${hostel.hostel_name}`}
      className={`w-full text-left bg-card border border-border rounded-xl p-4 transition-transform group hover:border-accent/40 ${
        detailHostelId ? 'cursor-pointer active:scale-[0.99]' : 'opacity-60 cursor-not-allowed'
      } ${cardBorder}`}
    >
      {/* Row 1: name + trophy + status badge + action menu */}
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-lg bg-secondary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-foreground truncate text-[15px] group-hover:text-accent">
              {hostel.hostel_name}
            </h3>
            {hostel.is_top_performer && (
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            {hasAlert && (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
          </div>
          {hostel.city && (
            <p className="text-xs text-muted-foreground truncate">{hostel.city}</p>
          )}
          <HostelStatusBadge status={status} className="mt-1.5" />
        </div>

        {/* Action menu (replaces old edit button + chevron) */}
        {onEdit ? (
          <HostelActionMenu
            hostelId={detailHostelId}
            hostelName={hostel.hostel_name}
            status={status}
            onNavigate={(id) => navigate(`/hostels/${id}`)}
            onEdit={onEdit}
            onPause={onPause ?? (() => {})}
            onClose={onClose ?? (() => {})}
            onResume={onResume ?? (() => {})}
            onRestore={onRestore ?? (() => {})}
          />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </div>

      {/* Row 2: operational metrics — hidden for ARCHIVED */}
      {!isArchived && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Beds</p>
            <BedsLabel
              active={occupiedBeds}
              capacity={totalCapacity}
              vacant={vacantBeds}
            />
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Outstanding</p>
            <DuesLabel amount={hostel.pending_dues} />
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Collected</p>
            <span className="text-sm font-semibold text-foreground">{fmt(hostel.revenue)}</span>
          </div>
        </div>
      )}

      {/* Row 2 (ARCHIVED): only collected — historical */}
      {isArchived && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase text-muted-foreground">Total Collected</p>
            <span className="text-sm font-semibold text-foreground">{fmt(hostel.revenue)}</span>
          </div>
        </div>
      )}

      {/* CTA — label changes per status */}
      {!onEdit && (
        <div className="mt-3 flex justify-end">
          <span className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground">
            {ctaLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export const HostelPerformanceCard = memo(HostelPerformanceCardComponent);
