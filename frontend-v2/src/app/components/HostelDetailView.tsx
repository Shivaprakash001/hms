import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Users, DollarSign, BedDouble, Receipt, AlertCircle, Plus, CreditCard, Phone, Wifi, FileText, Eye, EyeOff, Copy, Check, Pencil, Layers, ChevronDown, ChevronRight, X } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { dashboardService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { AddTenantModal } from './modals/AddTenantModal';
import { RecordPaymentModal } from './modals/RecordPaymentModal';

type Tab = 'overview' | 'rooms' | 'tenants' | 'financials' | 'expenses' | 'moveouts';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'financials', label: 'Financials' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'moveouts', label: 'Move-Outs' },
];

export function HostelDetailView() {
  const { hostelId, tab } = useParams<{ hostelId: string; tab?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>((tab as Tab) || 'overview');

  const { data: hostels = [] } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostelList = Array.isArray(hostels) ? hostels : (hostels as { hostels?: unknown[] })?.hostels || [];
  const hostel = hostelList.find((h: { id: string }) => h.id === hostelId);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(hostelId!),
    queryFn: () => dashboardService.getStats(hostelId!),
    enabled: !!hostelId,
    staleTime: 2 * 60 * 1000,
  });

  if (!hostelId) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border z-10">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate('/hostels')}
              className="p-2 -ml-2 shrink-0 active:scale-95 transition-transform touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-foreground truncate">
                {hostel ? (hostel as { name: string }).name : 'Hostel'}
              </h1>
              {hostel && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{(hostel as { address?: string; city?: string }).address || (hostel as { city?: string }).city || ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors touch-manipulation ${
                  activeTab === t.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground active:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 min-w-0">
        {activeTab === 'overview' && <OverviewTab hostelId={hostelId} stats={stats} loading={statsLoading} />}
        {activeTab === 'rooms' && <RoomsTab hostelId={hostelId} />}
        {activeTab === 'tenants' && <TenantsTab hostelId={hostelId} />}
        {activeTab === 'financials' && <FinancialsTab hostelId={hostelId} />}
        {activeTab === 'expenses' && <ExpensesTab hostelId={hostelId} />}
        {activeTab === 'moveouts' && <MoveOutsTab hostelId={hostelId} />}
      </div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 h-20" />
      ))}
    </div>
  );
}

function TabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm text-muted-foreground">Failed to load data</p>
      <button onClick={onRetry} className="text-xs text-accent font-medium">
        Retry
      </button>
    </div>
  );
}

function fmt(amount: unknown): string {
  const n = Number(amount || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function OverviewTab({ hostelId, stats, loading }: { hostelId: string; stats: Record<string, unknown> | undefined; loading: boolean }) {
  if (loading) return <TabSkeleton />;

  const occupancy = Number(stats?.occupancy_rate ?? stats?.occupancyRate ?? 0);
  const occupiedRooms = Number(stats?.occupied_rooms ?? stats?.occupiedRooms ?? 0);
  const totalRooms = Number(stats?.total_rooms ?? stats?.totalRooms ?? 0);
  const revenue = Number(stats?.total_revenue ?? stats?.totalRevenue ?? stats?.monthly_revenue ?? 0);
  const activeTenants = Number(stats?.active_tenants ?? stats?.activeTenants ?? 0);
  const pendingDues = Number(stats?.pending_dues ?? stats?.pendingDues ?? stats?.overdue_count ?? 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Occupancy', icon: <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />, value: `${occupancy.toFixed(0)}%`, sub: `${occupiedRooms}/${totalRooms} rooms` },
          { label: 'Revenue', icon: <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />, value: fmt(revenue), sub: 'This month' },
          { label: 'Active Tenants', icon: <Users className="w-4 h-4 text-muted-foreground shrink-0" />, value: String(activeTenants), sub: 'Currently staying' },
          { label: 'Pending Dues', icon: <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />, value: String(pendingDues), sub: 'Requires attention', accent: true },
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

      {!stats && (
        <div className="text-center py-8 text-sm text-muted-foreground">No stats available</div>
      )}
    </div>
  );
}

// ─── WiFi reveal cell ────────────────────────────────────────────────────────
function WifiCell({ wifiName, wifiPassword }: { wifiName: string | null; wifiPassword: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!wifiName && !wifiPassword) return null;

  const handleCopy = () => {
    if (wifiPassword) {
      navigator.clipboard.writeText(wifiPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <Wifi className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground truncate flex-1">{wifiName || '—'}</span>
      {wifiPassword && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-mono text-foreground">
            {revealed ? wifiPassword : '••••••••'}
          </span>
          <button onClick={() => setRevealed((v) => !v)} className="p-1 text-muted-foreground active:scale-90">
            {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button onClick={handleCopy} className="p-1 text-muted-foreground active:scale-90">
            {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Edit Room Modal ──────────────────────────────────────────────────────────
function EditRoomModal({
  room,
  floors,
  onClose,
  onSave,
  saving,
}: {
  room: Record<string, unknown>;
  floors: Record<string, unknown>[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    room_no:       String(room.room_no ?? ''),
    capacity:      String(room.capacity ?? '1'),
    base_rent:     String(room.base_rent ?? room.monthly_rent ?? ''),
    floor_id:      String(room.floor_id ?? ''),
    wifi_name:     String(room.wifi_name ?? ''),
    wifi_password: String(room.wifi_password ?? ''),
    notes:         String(room.notes ?? ''),
  });
  const [showWifi, setShowWifi] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      room_no:       form.room_no,
      capacity:      Number(form.capacity),
      base_rent:     form.base_rent ? Number(form.base_rent) : undefined,
      floor_id:      form.floor_id || undefined,
      wifi_name:     form.wifi_name || null,
      wifi_password: form.wifi_password || null,
      notes:         form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card rounded-t-2xl border-t border-border max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground text-sm">Edit Room</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground active:scale-90">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 pb-8 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Room Name</label>
              <input value={form.room_no} onChange={set('room_no')} required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capacity (beds)</label>
              <input type="number" min={1} max={20} value={form.capacity} onChange={set('capacity')} required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Monthly Rent (₹)</label>
              <input type="number" min={0} value={form.base_rent} onChange={set('base_rent')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Floor</label>
              <select value={form.floor_id} onChange={set('floor_id')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="">— No floor —</option>
                {floors.map((f) => (
                  <option key={String(f.id)} value={String(f.id)}>{String(f.name)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={set('notes') as any}
              placeholder="Attached bathroom, AC, balcony…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>

          <div>
            <button type="button" onClick={() => setShowWifi((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2">
              <Wifi className="w-3.5 h-3.5" />
              WiFi credentials
              {showWifi ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {showWifi && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Network name (SSID)</label>
                  <input value={form.wifi_name} onChange={set('wifi_name')} placeholder="MyHostel_WiFi"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                  <input type="text" value={form.wifi_password} onChange={set('wifi_password')} placeholder="Tap to enter"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Add Floor Modal ──────────────────────────────────────────────────────────
function AddFloorModal({
  onClose,
  onAdd,
  adding,
}: { onClose: () => void; onAdd: (name: string) => void; adding: boolean }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-card rounded-t-2xl border-t border-border p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground text-sm">Add Floor</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ground Floor, Boys Wing A…"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent mb-3"
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); onAdd(name.trim()); } }}
        />
        <button
          disabled={!name.trim() || adding}
          onClick={() => onAdd(name.trim())}
          className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold disabled:opacity-40">
          {adding ? 'Adding…' : 'Add Floor'}
        </button>
      </div>
    </div>
  );
}

// ─── Rooms Tab ────────────────────────────────────────────────────────────────
function RoomsTab({ hostelId }: { hostelId: string }) {
  const qc = useQueryClient();
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editRoom, setEditRoom] = useState<Record<string, unknown> | null>(null);
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: roomsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.rooms.list(hostelId),
    queryFn: () => import('@features/rooms/api').then((m) => m.roomService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors', hostelId],
    queryFn: () => import('@features/rooms/api').then((m) => m.floorService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      import('@features/rooms/api').then((m) => m.roomService.update(id, data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rooms.list(hostelId) });
      qc.invalidateQueries({ queryKey: ['floors', hostelId] });
      setEditRoom(null);
    },
  });

  const addFloorMutation = useMutation({
    mutationFn: async (name: string) =>
      import('@features/rooms/api').then((m) => m.floorService.create(hostelId, { name })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floors', hostelId] });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.list(hostelId) });
      setShowAddFloor(false);
    },
  });

  if (isLoading) return <TabSkeleton />;
  if (isError)   return <TabError onRetry={refetch} />;

  const rooms: Record<string, unknown>[] = Array.isArray(roomsData) ? roomsData : [];
  const floors: Record<string, unknown>[] = Array.isArray(floorsData) ? floorsData : [];

  // Group rooms by floor; rooms now carry floor_name + floor_sort_order from the backend
  const floorGroups: Map<string, { id: string; name: string; sort: number; rooms: Record<string, unknown>[] }> = new Map();

  rooms.forEach((room) => {
    const fid   = String(room.floor_id ?? '__none');
    const fname = String(room.floor_name ?? (room.floor_id ? 'Floor' : 'Unassigned'));
    const fsort = Number(room.floor_sort_order ?? 999);
    if (!floorGroups.has(fid)) floorGroups.set(fid, { id: fid, name: fname, sort: fsort, rooms: [] });
    floorGroups.get(fid)!.rooms.push(room);
  });

  // If no rooms yet, add floor placeholders from floorsData
  floors.forEach((f) => {
    const fid = String(f.id);
    if (!floorGroups.has(fid)) {
      floorGroups.set(fid, { id: fid, name: String(f.name), sort: Number(f.sort_order ?? 0), rooms: [] });
    }
  });

  const groups = Array.from(floorGroups.values()).sort((a, b) => a.sort - b.sort);
  const totalRooms    = rooms.length;
  const totalOccupied = rooms.reduce((s, r) => s + Number(r.occupied_count ?? 0), 0);
  const totalBeds     = rooms.reduce((s, r) => s + Number(r.capacity ?? 0), 0);
  const totalVacant   = rooms.filter((r) => String(r.status) === 'vacant').length;

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-3">
          <div className="text-base font-semibold text-[#10B981]">{totalOccupied}/{totalBeds}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Beds occupied</div>
        </div>
        <div className={`rounded-xl p-3 ${ totalVacant > 0 ? 'bg-[#3B82F6]/8 border border-[#3B82F6]/20' : 'bg-card border border-border' }`}>
          <div className={`text-base font-semibold ${ totalVacant > 0 ? 'text-[#3B82F6]' : 'text-foreground' }`}>{totalVacant}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Vacant rooms</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-base font-semibold text-foreground">{groups.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Floors</div>
        </div>
      </div>

      {/* Floor groups */}
      {groups.length === 0 && totalRooms === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
            <BedDouble className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No rooms yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add a floor then assign rooms to it</p>
          </div>
        </div>
      ) : groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        const groupVacant = group.rooms.filter((r) => String(r.status) === 'vacant').length;
        return (
          <div key={group.id}>
            {/* Floor header */}
            <button
              onClick={() => toggleCollapse(group.id)}
              className="w-full flex items-center justify-between py-2 touch-manipulation"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{group.name}</span>
                <span className="text-[10px] text-muted-foreground">{group.rooms.length} rooms</span>
                {groupVacant > 0 && (
                  <span className="text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] px-1.5 py-0.5 rounded-full font-medium">{groupVacant} vacant</span>
                )}
              </div>
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {!isCollapsed && (
              <div className="space-y-2 pl-0">
                {group.rooms.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3 pl-5">No rooms on this floor yet</div>
                ) : group.rooms.map((room) => {
                  const isOccupied = String(room.status) === 'occupied';
                  const occupied   = Number(room.occupied_count ?? 0);
                  const capacity   = Number(room.capacity ?? 0);
                  return (
                    <div
                      key={String(room.id)}
                      className={`bg-card border rounded-xl p-3.5 min-w-0 ${ !isOccupied ? 'border-[#3B82F6]/15' : 'border-border' }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{String(room.room_no)}</span>
                            {/* Capacity chip */}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              occupied === 0   ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                              : occupied < capacity ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#10B981]/10 text-[#10B981]'
                            }`}>
                              {occupied}/{capacity} beds
                            </span>
                          </div>
                          {isOccupied && room.tenant_name && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">{String(room.tenant_name)}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-0.5">{fmt(room.monthly_rent ?? room.base_rent ?? 0)}/mo</div>
                          {room.notes && (
                            <div className="flex items-start gap-1 mt-1.5">
                              <FileText className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                              <span className="text-[11px] text-muted-foreground leading-snug">{String(room.notes)}</span>
                            </div>
                          )}
                          <WifiCell
                            wifiName={room.wifi_name ? String(room.wifi_name) : null}
                            wifiPassword={room.wifi_password ? String(room.wifi_password) : null}
                          />
                        </div>
                        <button
                          onClick={() => setEditRoom(room)}
                          className="p-1.5 text-muted-foreground active:scale-90 shrink-0 mt-0.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!isOccupied && (
                        <button
                          onClick={() => setShowAddTenant(true)}
                          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 bg-card border border-border rounded-lg text-xs font-medium text-accent active:scale-95 transition-transform touch-manipulation"
                        >
                          <Plus className="w-3.5 h-3.5" /> Assign Tenant
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Floor */}
      <button
        onClick={() => setShowAddFloor(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground active:text-foreground active:border-foreground transition-colors touch-manipulation"
      >
        <Plus className="w-3.5 h-3.5" /> Add Floor
      </button>

      {showAddTenant && <AddTenantModal hostelId={hostelId} onClose={() => setShowAddTenant(false)} />}
      {showAddFloor && (
        <AddFloorModal
          onClose={() => setShowAddFloor(false)}
          onAdd={(name) => addFloorMutation.mutate(name)}
          adding={addFloorMutation.isPending}
        />
      )}
      {editRoom && (
        <EditRoomModal
          room={editRoom}
          floors={floors}
          onClose={() => setEditRoom(null)}
          onSave={(data) => updateMutation.mutate({ id: String(editRoom.id), data })}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function TenantsTab({ hostelId }: { hostelId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<string>('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'ACTIVE' })),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const tenants: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.tenants)
    ? ((data as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Active Tenants</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent active:scale-95 transition-transform touch-manipulation"
        >
          <Plus className="w-3.5 h-3.5" /> Add Tenant
        </button>
      </div>

      {tenants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No active tenants</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first tenant to get started</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-semibold active:scale-95 transition-transform touch-manipulation"
          >
            Add Tenant
          </button>
        </div>
      )}
      {tenants.map((tenant) => {
        const paymentStatus = String(tenant.payment_status ?? 'unknown').toLowerCase();
        const isPaid = paymentStatus === 'paid';
        const isOverdue = paymentStatus === 'overdue';
        const dueAmt = Number(tenant.outstanding_amount ?? tenant.due_amount ?? tenant.dues ?? 0);
        const room = tenant.room_no ?? tenant.room_number ?? tenant.room;
        const dueDate = tenant.due_date ? new Date(String(tenant.due_date)) : null;
        const now = Date.now();
        const overdueDays = dueDate && dueDate.getTime() < now
          ? Math.floor((now - dueDate.getTime()) / 86400000)
          : 0;
        const tenantId = String(tenant.obligation_id ?? tenant.id ?? '');
        return (
          <div key={String(tenant.id)} className={`bg-card border rounded-xl p-4 min-w-0 ${
            isOverdue ? 'border-[#EF4444]/20' : 'border-border'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]'
                : isPaid ? 'bg-[#10B981]/10 text-[#10B981]'
                : 'bg-accent/10 text-accent'
              }`}>
                {String(tenant.name ?? 'T').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{String(tenant.name ?? '')}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isPaid ? 'bg-[#10B981]/10 text-[#10B981]'
                    : isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]'
                    : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  }`}>
                    {isPaid ? 'Paid' : isOverdue ? (overdueDays > 0 ? `${overdueDays}d overdue` : 'Overdue') : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {room && <span className="text-xs text-muted-foreground">Room {String(room)}</span>}
                  {room && <span className="text-muted-foreground text-xs">·</span>}
                  <span className="text-xs text-muted-foreground">{fmt(tenant.monthly_rent ?? tenant.rent ?? 0)}/mo</span>
                </div>
                {!isPaid && dueAmt > 0 && (
                  <div className={`text-xs font-medium mt-1 ${
                    isOverdue ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                  }`}>
                    {fmt(dueAmt)} outstanding
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {tenant.phone && (
                  <a
                    href={`tel:${String(tenant.phone)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-muted-foreground active:scale-95 transition-transform"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            {!isPaid && (
              <button
                onClick={() => setShowPayment(tenantId)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 bg-accent text-accent-foreground rounded-lg text-xs font-semibold active:scale-[0.98] transition-transform touch-manipulation"
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                Record Payment
              </button>
            )}
          </div>
        );
      })}

      {showAdd && <AddTenantModal hostelId={hostelId} onClose={() => setShowAdd(false)} />}
      {showPayment && (
        <RecordPaymentModal
          hostelId={hostelId}
          initialDueId={showPayment}
          onClose={() => setShowPayment('')}
        />
      )}
    </div>
  );
}

function FinancialsTab({ hostelId }: { hostelId: string }) {
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const { data: payments, isLoading: pLoading, isError: pError, refetch: pRefetch } = useQuery({
    queryKey: queryKeys.payments.ledger(hostelId, { limit: 20 }),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAll(hostelId, { limit: 20 })),
    staleTime: 2 * 60 * 1000,
  });
  const { data: dues, isLoading: dLoading } = useQuery({
    queryKey: queryKeys.payments.dues(hostelId),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAllDues(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  if (pLoading || dLoading) return <TabSkeleton />;
  if (pError) return <TabError onRetry={pRefetch} />;

  const paymentList: Record<string, unknown>[] = Array.isArray(payments)
    ? payments
    : Array.isArray((payments as Record<string, unknown>)?.payments)
    ? ((payments as Record<string, unknown>).payments as Record<string, unknown>[])
    : [];

  const duesList: Record<string, unknown>[] = Array.isArray(dues) ? dues : [];
  const totalPending = duesList.reduce((sum, d) => sum + Number(d.amount ?? d.outstanding ?? 0), 0);
  const totalCollected = paymentList.reduce((sum, p) => sum + Number(p.amount_paid ?? p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Financials</h3>
        <button
          onClick={() => setShowRecordPayment(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent active:scale-95 transition-transform"
        >
          <Plus className="w-3.5 h-3.5" /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Collected</div>
          <div className="text-xl font-semibold text-foreground">{fmt(totalCollected)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Recent payments</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Pending Dues</div>
          <div className="text-xl font-semibold text-[#F59E0B]">{fmt(totalPending)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{duesList.length} obligations</div>
        </div>
      </div>

      {showRecordPayment && (
        <RecordPaymentModal hostelId={hostelId} onClose={() => setShowRecordPayment(false)} />
      )}

      {paymentList.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Recent Payments</h3>
          <div className="space-y-2">
            {paymentList.slice(0, 10).map((p) => (
              <div key={String(p.id)} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{String(p.tenant_name ?? p.name ?? 'Tenant')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.payment_date ? new Date(String(p.payment_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{fmt(p.amount_paid ?? p.amount)}</div>
                  <div className="text-[10px] text-[#10B981] mt-0.5">Received</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpensesTab({ hostelId }: { hostelId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.expenses.list(hostelId),
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const expenses: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.expenses)
    ? ((data as Record<string, unknown>).expenses as Record<string, unknown>[])
    : [];

  const total = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  if (expenses.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">No expenses recorded</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs text-muted-foreground mb-1">Total Expenses</div>
        <div className="text-2xl font-semibold text-foreground">{fmt(total)}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{expenses.length} transactions</div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Expense History</h3>
        <div className="space-y-2">
          {expenses.map((expense, i) => (
            <div key={String(expense.id ?? i)} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-sm font-medium text-foreground">{String(expense.category ?? expense.expense_type ?? 'Expense')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{String(expense.description ?? expense.notes ?? '')}</div>
                </div>
                <div className="text-sm font-semibold text-foreground">{fmt(expense.amount)}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {expense.expense_date ? new Date(String(expense.expense_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoveOutsTab({ hostelId }: { hostelId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId, { status: 'LEFT' }),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'LEFT', limit: 20 })),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const moveouts: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.tenants)
    ? ((data as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  if (moveouts.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">No recent move-outs</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Recent Move-Outs</h3>
        <span className="text-xs text-muted-foreground">{moveouts.length} tenants</span>
      </div>
      {moveouts.map((moveout, i) => {
        const leftDate = String(moveout.move_out_date ?? moveout.left_at ?? moveout.updated_at ?? '');
        const deposit = Number(moveout.deposit_amount ?? moveout.advance_paid ?? 0);
        return (
          <div key={String(moveout.id ?? i)} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-foreground">{String(moveout.name ?? '')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Room {String(moveout.room_no ?? moveout.room_number ?? '')}</div>
              </div>
              <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-[#6B7280]/10 text-[#6B7280]">
                Left
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">
                {leftDate ? new Date(leftDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </span>
              {deposit > 0 && <span className="font-medium text-foreground">Deposit: {fmt(deposit)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
