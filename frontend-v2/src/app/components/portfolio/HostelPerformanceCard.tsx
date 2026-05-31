import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useIsMobile } from '@/app/components/ui/use-mobile';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export interface HostelRanking {
  hostel_id: string;
  hostel_name: string;
  city?: string | null;
  revenue: number;
  occupancy_rate: number;
  collection_rate: number;
  pending_dues: number;
  active_tenants?: number;
  trend_percentage: number;
  is_top_performer?: boolean;
}

interface Props {
  hostel: HostelRanking;
  rank: number;
  onEdit?: (hostelId: string) => void;
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs font-semibold">
        <TrendingUp className="w-3.5 h-3.5" />+{pct}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-destructive text-xs font-semibold">
        <TrendingDown className="w-3.5 h-3.5" />
        {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs font-medium">
      <Minus className="w-3.5 h-3.5" />0%
    </span>
  );
}

function HostelPerformanceCardComponent({ hostel, rank, onEdit }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const detailHostelId = String(hostel.hostel_id || (hostel as unknown as { id?: string }).id || '');

  const openDetail = () => {
    if (!detailHostelId) return;
    navigate(`/hostels/${detailHostelId}`);
  };

  const metrics = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3 pt-3 border-t border-border">
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">Revenue</p>
        <p className="font-semibold text-foreground">{fmt(hostel.revenue)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">Collection</p>
        <p className="font-semibold text-foreground">{hostel.collection_rate.toFixed(0)}%</p>
      </div>
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">Occupancy</p>
        <p className="font-semibold text-foreground">{hostel.occupancy_rate.toFixed(0)}%</p>
      </div>
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">Pending</p>
        <p className={`font-semibold ${hostel.pending_dues > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {fmt(hostel.pending_dues)}
        </p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full p-4 text-left touch-manipulation"
          aria-expanded={expanded}
        >
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-secondary text-xs font-bold flex items-center justify-center shrink-0">
              {rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground truncate">{hostel.hostel_name}</h3>
                {hostel.is_top_performer && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
              </div>
              {hostel.city && (
                <p className="text-xs text-muted-foreground truncate">{hostel.city}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-foreground">{fmt(hostel.revenue)}</span>
                <TrendBadge pct={hostel.trend_percentage} />
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
        {expanded && (
          <div className="px-4 pb-4">
            {metrics}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={openDetail}
                disabled={!detailHostelId}
                className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold"
              >
                Manage property
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => detailHostelId && onEdit(detailHostelId)}
                  disabled={!detailHostelId}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openDetail}
      disabled={!detailHostelId}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-lg bg-secondary text-xs font-bold flex items-center justify-center shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate group-hover:text-accent">
              {hostel.hostel_name}
            </h3>
            {hostel.is_top_performer && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <Trophy className="w-3 h-3" /> Top
              </span>
            )}
          </div>
          {hostel.city && <p className="text-xs text-muted-foreground">{hostel.city}</p>}
        </div>
        <TrendBadge pct={hostel.trend_percentage} />
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>
      {metrics}
    </button>
  );
}

export const HostelPerformanceCard = memo(HostelPerformanceCardComponent);
