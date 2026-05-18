import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, Building2, AlertTriangle, Loader2, ChevronRight, IndianRupee } from 'lucide-react';
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
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Overview across all your properties'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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

          {hostels.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-foreground mb-3">
                Properties <span className="text-muted-foreground font-normal">({hostels.length})</span>
              </h2>
              <div className="space-y-2">
                {hostels.map((h) => (
                  <button
                    key={String(h.id)}
                    onClick={() => navigate(`/hostels/${h.id}`)}
                    className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform touch-manipulation"
                  >
                    <div className="text-left min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{String(h.name ?? '')}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{String(h.city ?? h.address ?? '')}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {hostels.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hostels added yet</p>
              <button
                onClick={() => navigate('/hostels')}
                className="mt-3 text-sm text-accent font-medium"
              >
                Add your first hostel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
