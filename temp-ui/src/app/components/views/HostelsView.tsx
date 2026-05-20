import { useState } from 'react';
import { Search, Plus, SlidersHorizontal } from 'lucide-react';
import { HostelDetailView } from '../HostelDetailView';
import { AddHostelModal } from '../modals/AddHostelModal';
import { FilterModal, FilterOptions } from '../modals/FilterModal';

const hostels = [
  {
    id: '1',
    name: 'Sri Adithya Koramangala',
    location: 'Koramangala, Bangalore',
    occupancy: 92,
    totalRooms: 45,
    occupiedRooms: 41,
    revenue: '₹4.2L',
    pendingPayments: 3,
    alerts: 2,
  },
  {
    id: '2',
    name: 'Sri Adithya Indiranagar',
    location: 'Indiranagar, Bangalore',
    occupancy: 78,
    totalRooms: 32,
    occupiedRooms: 25,
    revenue: '₹2.8L',
    pendingPayments: 5,
    alerts: 0,
  },
  {
    id: '3',
    name: 'Sri Adithya HSR Layout',
    location: 'HSR Layout, Bangalore',
    occupancy: 95,
    totalRooms: 28,
    occupiedRooms: 27,
    revenue: '₹3.1L',
    pendingPayments: 1,
    alerts: 1,
  },
  {
    id: '4',
    name: 'Sri Adithya Whitefield',
    location: 'Whitefield, Bangalore',
    occupancy: 85,
    totalRooms: 38,
    occupiedRooms: 32,
    revenue: '₹2.3L',
    pendingPayments: 4,
    alerts: 3,
  },
];

export function HostelsView() {
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    occupancy: [],
    revenue: [],
    alerts: [],
  });

  const selectedHostel = hostels.find(h => h.id === selectedHostelId);

  if (selectedHostel) {
    return <HostelDetailView hostel={selectedHostel} onBack={() => setSelectedHostelId(null)} />;
  }

  const applyFilters = (hostel: typeof hostels[0]) => {
    // Occupancy filter
    if (filters.occupancy.length > 0) {
      const occupancyMatch = filters.occupancy.some(filter => {
        if (filter === 'high' && hostel.occupancy > 90) return true;
        if (filter === 'medium' && hostel.occupancy >= 75 && hostel.occupancy <= 90) return true;
        if (filter === 'low' && hostel.occupancy < 75) return true;
        return false;
      });
      if (!occupancyMatch) return false;
    }

    // Revenue filter
    if (filters.revenue.length > 0) {
      const revenueValue = parseFloat(hostel.revenue.replace('₹', '').replace('L', '')) * 100000;
      const revenueMatch = filters.revenue.some(filter => {
        if (filter === 'above-4l' && revenueValue > 400000) return true;
        if (filter === '2l-4l' && revenueValue >= 200000 && revenueValue <= 400000) return true;
        if (filter === 'below-2l' && revenueValue < 200000) return true;
        return false;
      });
      if (!revenueMatch) return false;
    }

    // Alerts filter
    if (filters.alerts.length > 0) {
      const alertsMatch = filters.alerts.some(filter => {
        if (filter === 'critical' && hostel.alerts > 2) return true;
        if (filter === 'warnings' && hostel.alerts > 0 && hostel.alerts <= 2) return true;
        if (filter === 'no-alerts' && hostel.alerts === 0) return true;
        return false;
      });
      if (!alertsMatch) return false;
    }

    return true;
  };

  const filteredHostels = hostels
    .filter(h =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.location.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(applyFilters);

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
      <div className="space-y-3">
        {filteredHostels.map((hostel) => (
          <div
            key={hostel.id}
            onClick={() => setSelectedHostelId(hostel.id)}
            className="bg-card border border-border rounded-xl p-4 space-y-3 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="space-y-1">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-foreground">{hostel.name}</h3>
                {hostel.alerts > 0 && (
                  <span className="bg-[#EF4444] text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                    {hostel.alerts}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{hostel.location}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Occupancy</div>
                <div className="text-base font-semibold text-foreground mt-0.5">{hostel.occupancy}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Rooms</div>
                <div className="text-base font-semibold text-foreground mt-0.5">{hostel.occupiedRooms}/{hostel.totalRooms}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Revenue</div>
                <div className="text-base font-semibold text-foreground mt-0.5">{hostel.revenue}</div>
              </div>
            </div>
          </div>
        ))}

        {filteredHostels.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hostels found</p>
          </div>
        )}
      </div>

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
