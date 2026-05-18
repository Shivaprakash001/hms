import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, SlidersHorizontal, Loader2, Building2 } from 'lucide-react';
import { AddHostelModal } from '../modals/AddHostelModal';
import { FilterModal, FilterOptions } from '../modals/FilterModal';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';

export function HostelsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    occupancy: [],
    revenue: [],
    alerts: [],
  });

  const { data: hostelsData, isLoading } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as Record<string, unknown>)?.hostels)
    ? ((hostelsData as Record<string, unknown>).hostels as Record<string, unknown>[])
    : [];

  const filteredHostels = hostels.filter((h) => {
    const name = String(h.name ?? '').toLowerCase();
    const city = String(h.city ?? h.address ?? '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || city.includes(q);
  });

  const activeFilterCount = filters.occupancy.length + filters.revenue.length + filters.alerts.length;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hostels</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your properties</p>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search hostels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Add New Hostel */}
      <button
        onClick={() => setShowAddHostel(true)}
        className="w-full bg-accent text-accent-foreground p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Create New Hostel</span>
      </button>

      {/* Hostels List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHostels.map((hostel) => {
            const occupancy = Number(hostel.occupancy_rate ?? hostel.occupancy ?? 0);
            const occupiedRooms = Number(hostel.occupied_rooms ?? hostel.occupiedRooms ?? 0);
            const totalRooms = Number(hostel.total_rooms ?? hostel.totalRooms ?? 0);
            return (
              <div
                key={String(hostel.id)}
                onClick={() => navigate(`/hostels/${hostel.id}`)}
                className="bg-card border border-border rounded-xl p-4 space-y-3 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">{String(hostel.name ?? '')}</h3>
                  <p className="text-xs text-muted-foreground">{String(hostel.city ?? hostel.address ?? '')}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Occupancy</div>
                    <div className="text-base font-semibold text-foreground mt-0.5">{occupancy.toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rooms</div>
                    <div className="text-base font-semibold text-foreground mt-0.5">{occupiedRooms}/{totalRooms}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tenants</div>
                    <div className="text-base font-semibold text-foreground mt-0.5">{String(hostel.active_tenants ?? hostel.tenant_count ?? '—')}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredHostels.length === 0 && hostels.length > 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No hostels match your search</p>
            </div>
          )}

          {hostels.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hostels yet</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddHostel && (
        <AddHostelModal
          onClose={() => setShowAddHostel(false)}
          onSubmit={(data) => {
            console.log('Create hostel:', data);
            setShowAddHostel(false);
          }}
        />
      )}
      {showFilter && (
        <FilterModal
          onClose={() => setShowFilter(false)}
          onApply={setFilters}
          currentFilters={filters}
        />
      )}
    </div>
  );
}
