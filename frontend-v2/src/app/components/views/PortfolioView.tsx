import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Plus,
  SlidersHorizontal,
  Building2,
  AlertCircle,
  CreditCard,
  UserPlus,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { portfolioService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { PortfolioRevenueChart } from '@/app/components/portfolio/PortfolioRevenueChart';
import { HostelPerformanceCard } from '@/app/components/portfolio/HostelPerformanceCard';
import { AddHostelModal } from '@/app/components/modals/AddHostelModal';
import { FilterModal, FilterOptions } from '@/app/components/modals/FilterModal';
import { EditHostelSheet } from '@/app/components/modals/EditHostelSheet';

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

export function PortfolioView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ occupancy: [], revenue: [], alerts: [] });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.portfolio.performance(6),
    queryFn: () => portfolioService.getPerformance(6),
    staleTime: 2 * 60 * 1000,
  });

  const portfolio = data?.portfolio ?? {};
  const monthlyTrends = data?.monthly_trends ?? [];
  const rankings = data?.hostel_rankings ?? [];
  const topPerformer = rankings.find((h: { is_top_performer?: boolean }) => h.is_top_performer);

  const filteredRankings = rankings.filter((h: { hostel_name: string; city?: string | null }) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      h.hostel_name.toLowerCase().includes(q) ||
      String(h.city ?? '').toLowerCase().includes(q)
    );
  });

  const editingHostel = editingHostelId
    ? rankings.find((h: { hostel_id: string }) => h.hostel_id === editingHostelId)
    : null;

  const firstHostelId = rankings[0]?.hostel_id;
  const overdueHint = Number(portfolio.total_due ?? 0) > 0;

  return (
    <div className="px-4 py-5 space-y-5 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {user?.name ? `Portfolio · ${user.name.split(' ')[0]}` : 'Portfolio'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue intelligence across {rankings.length} propert{rankings.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        {overdueHint && (
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-semibold shrink-0"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Dues
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-72 bg-card border border-border rounded-xl animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Failed to load portfolio data</p>
          <button type="button" onClick={() => refetch()} className="mt-3 text-sm text-accent font-medium">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Revenue (month)',
                value: fmt(Number(portfolio.total_revenue ?? 0)),
                icon: IndianRupee,
              },
              {
                label: 'Collection rate',
                value: `${Number(portfolio.collection_rate ?? 0).toFixed(0)}%`,
                icon: TrendingUp,
              },
              {
                label: 'Pending dues',
                value: fmt(Number(portfolio.total_due ?? 0)),
                icon: AlertCircle,
                warn: Number(portfolio.total_due ?? 0) > 0,
              },
              {
                label: 'Active tenants',
                value: String(portfolio.active_tenants ?? 0),
                sub: `${Number(portfolio.occupancy_rate ?? 0).toFixed(0)}% occupancy`,
                icon: Building2,
              },
            ].map(({ label, value, sub, icon: Icon, warn }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                    {label}
                  </span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${warn ? 'text-destructive' : 'text-accent'}`} />
                </div>
                <p className={`text-lg font-bold truncate ${warn ? 'text-destructive' : 'text-foreground'}`}>
                  {value}
                </p>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          <PortfolioRevenueChart
            monthlyTrends={monthlyTrends}
            topPerformerId={data?.top_performer_hostel_id}
            topPerformerName={topPerformer?.hostel_name}
          />

          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <button
              type="button"
              onClick={() => setShowAddHostel(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-semibold shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Hostel
            </button>
            {firstHostelId && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/alerts')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl text-xs font-semibold shrink-0"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Collect Dues
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/hostels/${firstHostelId}/tenants`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-semibold shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Tenant
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search properties…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilter(true)}
              className="p-2.5 bg-card border border-border rounded-xl"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Property performance
              <span className="text-muted-foreground font-normal ml-1">(ranked by revenue)</span>
            </h2>
            {filteredRankings.length === 0 ? (
              <div className="text-center py-16 space-y-4 border border-dashed border-border rounded-xl">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {rankings.length === 0 ? 'No properties yet' : 'No matches'}
                </p>
                {rankings.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddHostel(true)}
                    className="px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-semibold"
                  >
                    Add first hostel
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRankings.map((hostel: Parameters<typeof HostelPerformanceCard>[0]['hostel'], i: number) => (
                  <HostelPerformanceCard
                    key={hostel.hostel_id}
                    hostel={hostel}
                    rank={i + 1}
                    onEdit={setEditingHostelId}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showAddHostel && <AddHostelModal onClose={() => { setShowAddHostel(false); refetch(); }} />}
      {showFilter && (
        <FilterModal onClose={() => setShowFilter(false)} onApply={setFilters} currentFilters={filters} />
      )}
      {editingHostelId && editingHostel && (
        <EditHostelSheet
          hostelId={editingHostelId}
          hostelName={editingHostel.hostel_name}
          onClose={() => setEditingHostelId(null)}
        />
      )}
    </div>
  );
}
