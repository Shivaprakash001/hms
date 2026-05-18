import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, AlertTriangle, Loader2, ChevronRight, IndianRupee, CreditCard, UserPlus, AlertCircle, BedDouble } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { dashboardService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { useAuth } from '@context/AuthContext';

function fmt(n: unknown): string {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export function PortfolioView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: hostelsData, isLoading: hostelsLoading } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as Record<string, unknown>)?.hostels)
    ? ((hostelsData as Record<string, unknown>).hostels as Record<string, unknown>[])
    : [];

  const firstHostelId = hostels.length > 0 ? String(hostels[0].id ?? '') : null;

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(firstHostelId ?? 'none'),
    queryFn: () => dashboardService.getStats(firstHostelId!),
    enabled: !!firstHostelId,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = hostelsLoading || (!!firstHostelId && statsLoading);
  const stats = statsData as Record<string, unknown> | undefined;

  const totalRevenue = Number(stats?.total_revenue ?? stats?.monthly_revenue ?? 0);
  const activeTenants = Number(stats?.active_tenants ?? stats?.total_tenants ?? 0);
  const occupancyRate = Number(stats?.occupancy_rate ?? 0);
  const pendingDues = Number(stats?.pending_dues_amount ?? stats?.overdue_amount ?? 0);
  const overdueCount = Number(stats?.overdue_count ?? stats?.pending_obligations ?? 0);
  const totalRooms = hostels.reduce((sum, h) => sum + Number(h.total_rooms ?? 0), 0);

  return (
    <div className="px-4 py-5 space-y-5 min-w-0">
      {/* Greeting header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {user?.name ? `Hey, ${user.name.split(' ')[0]} 👋` : 'Portfolio'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hostels.length > 0 ? `${hostels.length} propert${hostels.length === 1 ? 'y' : 'ies'}` : 'Overview'}
          </p>
        </div>
        {overdueCount > 0 && (
          <button
            onClick={() => navigate('/alerts')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] rounded-lg text-xs font-semibold shrink-0 active:scale-95 transition-transform touch-manipulation"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {overdueCount} overdue
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
          <div className="h-12 bg-card border border-border rounded-xl animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Revenue', icon: <IndianRupee className="w-4 h-4 text-muted-foreground shrink-0" />, value: fmt(totalRevenue), sub: 'This month', accent: false },
              { label: 'Active Tenants', icon: <Users className="w-4 h-4 text-muted-foreground shrink-0" />, value: String(activeTenants), sub: 'Currently staying', accent: false },
              { label: 'Occupancy', icon: <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />, value: `${occupancyRate.toFixed(0)}%`, sub: `${totalRooms} rooms`, accent: false },
              { label: 'Pending Dues', icon: <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />, value: fmt(pendingDues), sub: overdueCount > 0 ? `${overdueCount} overdue` : 'All clear', accent: overdueCount > 0 },
            ].map(({ label, icon, value, sub, accent }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 min-w-0">
                <div className="flex items-center justify-between mb-2 gap-1">
                  <span className="text-xs text-muted-foreground truncate">{label}</span>
                  {icon}
                </div>
                <div className="text-lg font-semibold text-foreground truncate">{value}</div>
                <div className={`text-[10px] mt-1 truncate ${accent ? 'text-[#F59E0B]' : 'text-muted-foreground'}`}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          {firstHostelId && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
              <button
                onClick={() => navigate('/alerts')}
                className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl text-xs font-semibold shrink-0 active:scale-95 transition-transform touch-manipulation"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Collect Dues
              </button>
              <button
                onClick={() => navigate(`/hostels/${firstHostelId}/tenants`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground rounded-xl text-xs font-semibold shrink-0 active:scale-95 transition-transform touch-manipulation"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Tenant
              </button>
              <button
                onClick={() => navigate('/hostels')}
                className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground rounded-xl text-xs font-semibold shrink-0 active:scale-95 transition-transform touch-manipulation"
              >
                <Building2 className="w-3.5 h-3.5" />
                Manage Hostels
              </button>
            </div>
          )}

          {hostels.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-foreground mb-3">
                Properties <span className="text-muted-foreground font-normal">({hostels.length})</span>
              </h2>
              <div className="space-y-2">
                {hostels.map((h) => {
                  const hOccupancy = Number(h.occupancy_rate ?? h.occupancy ?? 0);
                  const hTenants = Number(h.active_tenants ?? h.tenant_count ?? 0);
                  const hRooms = Number(h.total_rooms ?? 0);
                  const hOccupied = Number(h.occupied_rooms ?? 0);
                  return (
                    <button
                      key={String(h.id)}
                      onClick={() => navigate(`/hostels/${h.id}`)}
                      className="w-full bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform touch-manipulation min-w-0"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="text-left min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">{String(h.name ?? '')}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{String(h.city ?? h.address ?? '')}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-left">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <BedDouble className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground">Rooms</span>
                          </div>
                          <div className="text-xs font-semibold text-foreground mt-0.5">{hRooms > 0 ? `${hOccupied}/${hRooms}` : '—'}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground">Tenants</span>
                          </div>
                          <div className="text-xs font-semibold text-foreground mt-0.5">{hTenants > 0 ? hTenants : '—'}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <IndianRupee className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground">Occupancy</span>
                          </div>
                          <div className="text-xs font-semibold text-foreground mt-0.5">{hOccupancy > 0 ? `${hOccupancy.toFixed(0)}%` : '—'}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hostels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">No hostels yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first property to get started</p>
              </div>
              <button
                onClick={() => navigate('/hostels')}
                className="px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-semibold active:scale-95 transition-transform touch-manipulation"
              >
                Add First Hostel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
