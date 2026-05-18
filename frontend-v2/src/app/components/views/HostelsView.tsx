import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, SlidersHorizontal, Loader2, Building2, Settings } from 'lucide-react';
import { AddHostelModal } from '../modals/AddHostelModal';
import { FilterModal, FilterOptions } from '../modals/FilterModal';
import { EditHostelSheet } from '../modals/EditHostelSheet';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';

export function HostelsView() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ occupancy: [], revenue: [], alerts: [] });

  const { data: hostelsData, isLoading } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as any)?.data?.hostels)
    ? (hostelsData as any).data.hostels
    : Array.isArray((hostelsData as any)?.hostels)
    ? (hostelsData as any).hostels
    : [];

  const filteredHostels = hostels.filter(h => {
    const name = String(h.name ?? '').toLowerCase();
    const city = String(h.city ?? h.address ?? '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || city.includes(q);
  });

  const editingHostel = editingHostelId ? hostels.find(h => String(h.id) === editingHostelId) : null;
  const activeFilterCount = filters.occupancy.length + filters.revenue.length + filters.alerts.length;

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hostels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {hostels.length > 0
            ? `${hostels.length} ${hostels.length === 1 ? 'property' : 'properties'}`
            : 'Manage your properties'}
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search hostels…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          onClick={() => setShowFilter(true)}
          className="relative p-3 bg-card border border-border rounded-xl active:scale-95 transition-transform"
        >
          <SlidersHorizontal className="w-5 h-5 text-foreground" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Add CTA */}
      <button
        onClick={() => setShowAddHostel(true)}
        className="w-full bg-accent text-accent-foreground p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform font-medium"
      >
        <Plus className="w-5 h-5" />
        Add New Hostel
      </button>

      {/* Hostel list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-xl bg-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-secondary rounded" />
                  <div className="h-3 w-20 bg-secondary rounded" />
                </div>
              </div>
              <div className="h-1.5 bg-secondary rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(j => <div key={j} className="h-8 bg-secondary rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHostels.map(hostel => {
            const id = String(hostel.id);
            const name = String(hostel.name ?? '');
            const city = String(hostel.city ?? hostel.address ?? '');
            const logo = hostel.logo_url ? String(hostel.logo_url) : null;
            const occupancy = Number(hostel.occupancy_rate ?? hostel.occupancy ?? 0);
            const occupiedRooms = Number(hostel.occupied_rooms ?? hostel.occupiedRooms ?? 0);
            const totalRooms = Number(hostel.total_rooms ?? hostel.totalRooms ?? 0);
            const tenants = String(hostel.active_tenants ?? hostel.tenant_count ?? '—');
            const alerts = hostel.alert_count != null ? String(hostel.alert_count) : null;
            const hasOccupancy = totalRooms > 0;
            const initials = name.split(' ').map((w: string) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'H';
            const occColor = occupancy >= 70 ? 'text-emerald-500' : occupancy >= 40 ? 'text-amber-500' : 'text-muted-foreground';

            return (
              <div key={id} className="bg-card border border-border rounded-2xl overflow-hidden">

                {/* ── Header row ─── */}
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {logo
                      ? <img src={logo} alt={name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-accent">{initials}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="font-semibold text-foreground truncate leading-tight">{name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {city || <span className="opacity-40">No location set</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingHostelId(id)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0"
                    title="Edit hostel"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Occupancy bar ─── */}
                {hasOccupancy && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground">Occupancy</span>
                      <span className={`text-[11px] font-semibold ${occColor}`}>
                        {occupancy.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, occupancy)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Metrics ─── */}
                <div className="px-4 pb-3 grid grid-cols-3 gap-3 border-t border-border/50 pt-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rooms</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {hasOccupancy ? `${occupiedRooms}/${totalRooms}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tenants</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">{tenants}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Alerts</div>
                    <div className={`text-sm font-semibold mt-0.5 ${alerts && alerts !== '0' ? 'text-amber-500' : 'text-foreground'}`}>
                      {alerts ?? '—'}
                    </div>
                  </div>
                </div>

                {/* ── CTA ─── */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => navigate(`/hostels/${id}`)}
                    className="w-full py-2.5 bg-accent/10 hover:bg-accent/20 active:scale-[0.98] text-accent text-sm font-medium rounded-xl transition-colors touch-manipulation"
                  >
                    Manage Property
                  </button>
                </div>
              </div>
            );
          })}

          {filteredHostels.length === 0 && hostels.length > 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No hostels match your search</p>
            </div>
          )}

          {hostels.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
                <Building2 className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No properties yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first hostel to get started</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddHostel && <AddHostelModal onClose={() => setShowAddHostel(false)} />}
      {showFilter && (
        <FilterModal onClose={() => setShowFilter(false)} onApply={setFilters} currentFilters={filters} />
      )}
      {editingHostelId && editingHostel && (
        <EditHostelSheet
          hostelId={editingHostelId}
          hostelName={String(editingHostel.name ?? '')}
          onClose={() => setEditingHostelId(null)}
        />
      )}
    </div>
  );
}
