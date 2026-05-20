import { BedDouble, TrendingDown } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n || 0)}`;

interface Props {
  intel: any;
  stats: any;
}

function OccupancyChip({ occupied, capacity }: { occupied: number; capacity: number }) {
  const pct = capacity > 0 ? (occupied / capacity) : 0;
  const color = pct === 1 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
    pct > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
    'bg-muted text-muted-foreground';
  return (
    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', color)}>
      {occupied}/{capacity}
    </span>
  );
}

export function RoomPerformance({ intel, stats }: Props) {
  const rooms: any[] = Array.isArray(intel?.occupancy?.room_utilization)
    ? intel.occupancy.room_utilization
    : [];
  const vacancyRisk = intel?.occupancy?.vacancy_risk ?? 0;
  const d = stats?.data ?? stats ?? {};
  const expensePerTenant = intel?.expenses?.expense_per_tenant ?? 0;
  const revenuePerBed = d?.active_tenants > 0 ? Math.round((d?.revenue ?? 0) / d.active_tenants) : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" id="room-performance">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BedDouble className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Room Performance</h3>
        {vacancyRisk > 0 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>{fmt(vacancyRisk)} vacancy loss</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {revenuePerBed > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Revenue / tenant</div>
              <div className="text-sm font-bold text-foreground">{fmt(revenuePerBed)}</div>
            </div>
          )}
          {expensePerTenant > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Expense / tenant</div>
              <div className="text-sm font-bold text-foreground">{fmt(expensePerTenant)}</div>
            </div>
          )}
        </div>

        {rooms.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rooms.slice(0, 12).map((room: any, i: number) => {
              const occupied = Number(room.occupied_beds ?? room.occupied ?? 0);
              const capacity = Number(room.total_beds ?? room.capacity ?? 1);
              const daysOverdue = Number(room.avg_delay ?? room.average_delay ?? 0);
              const outstanding = Number(room.outstanding_dues ?? 0);
              const revenue = Number(room.revenue ?? 0);

              return (
                <div
                  key={room.room_id ?? room.room_no ?? i}
                  className="rounded-lg border border-border bg-muted/20 p-2.5 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[80px]">
                      {room.room_no ?? `Room ${i + 1}`}
                    </span>
                    <OccupancyChip occupied={occupied} capacity={capacity} />
                  </div>
                  {room.floor_name && (
                    <span className="text-xs text-muted-foreground">{room.floor_name}</span>
                  )}
                  {revenue > 0 && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{fmt(revenue)}</span>
                  )}
                  {outstanding > 0 && (
                    <span className="text-xs text-red-500 font-medium">{fmt(outstanding)} due</span>
                  )}
                  {daysOverdue > 0 && (
                    <span className="text-xs text-muted-foreground">{Math.round(daysOverdue)}d avg delay</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-6">
            No room utilization data available
          </div>
        )}
      </div>
    </div>
  );
}
