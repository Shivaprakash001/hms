import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Users, DollarSign, BedDouble, Receipt, AlertCircle, Plus, CreditCard, Phone, Wifi, FileText, Eye, EyeOff, Copy, Check, Pencil, Layers, ChevronDown, ChevronRight, X, Trash2, MoreVertical, TrendingUp, TrendingDown, Sparkles, Search, CalendarDays, Repeat2, Upload, Zap } from 'lucide-react';
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
              onClick={() => navigate('/dashboard')}
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

// ─── Room Form Modal (create + edit + delete) ────────────────────────────────
function RoomFormModal({
  room,
  defaultFloorId = '',
  floors,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting = false,
}: {
  room: Record<string, unknown> | null;
  defaultFloorId?: string;
  floors: Record<string, unknown>[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  saving: boolean;
  deleting?: boolean;
}) {
  const isEdit = room !== null;
  const [form, setForm] = useState({
    room_no:       isEdit ? String(room!.room_no ?? '') : '',
    capacity:      isEdit ? String(room!.capacity ?? '1') : '1',
    base_rent:     isEdit ? String(room!.base_rent ?? room!.monthly_rent ?? '') : '',
    floor_id:      isEdit ? String(room!.floor_id ?? '') : defaultFloorId,
    wifi_name:     isEdit ? String(room!.wifi_name ?? '') : '',
    wifi_password: isEdit ? String(room!.wifi_password ?? '') : '',
    notes:         isEdit ? String(room!.notes ?? '') : '',
  });
  const [showWifi, setShowWifi] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          <h2 className="font-semibold text-foreground text-sm">{isEdit ? 'Edit Room' : 'Add Room'}</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground active:scale-90">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 pb-8 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Room Name</label>
              <input value={form.room_no} onChange={set('room_no')} required placeholder="e.g. 101, A1"
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
              <input type="number" min={0} value={form.base_rent} onChange={set('base_rent')} placeholder="0"
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
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add Room'}
          </button>

          {isEdit && onDelete && (
            !confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-xs text-destructive font-medium rounded-xl border border-destructive/20 active:bg-destructive/5">
                <Trash2 className="w-3.5 h-3.5" /> Delete Room
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 text-xs font-medium rounded-xl border border-border text-muted-foreground">
                  Cancel
                </button>
                <button type="button" onClick={onDelete} disabled={deleting}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            )
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Floor Name Modal (add or rename) ───────────────────────────────────────
function FloorNameModal({
  title,
  initialName = '',
  submitLabel,
  onClose,
  onSubmit,
  busy,
}: {
  title: string;
  initialName?: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-card rounded-t-2xl border-t border-border p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground text-sm">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ground Floor, Boys Wing A…"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent mb-3"
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); onSubmit(name.trim()); } }}
        />
        <button
          disabled={!name.trim() || busy}
          onClick={() => onSubmit(name.trim())}
          className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold disabled:opacity-40">
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Floor Actions Sheet (kebab menu) ────────────────────────────────────────
function FloorActionsSheet({
  floor,
  onClose,
  onRename,
  onDelete,
  deleting,
}: {
  floor: { id: string; name: string };
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-card rounded-t-2xl border-t border-border p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">{floor.name}</p>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <button onClick={() => { onClose(); onRename(); }}
          className="w-full flex items-center gap-3 py-3 px-1 text-sm text-foreground active:bg-secondary rounded-lg">
          <Pencil className="w-4 h-4 text-muted-foreground" /> Rename Floor
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center gap-3 py-3 px-1 text-sm text-destructive active:bg-destructive/5 rounded-lg">
            <Trash2 className="w-4 h-4" /> Delete Floor
          </button>
        ) : (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground px-1">Only empty floors can be deleted. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl border border-border text-muted-foreground">
                Cancel
              </button>
              <button onClick={onDelete} disabled={deleting}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rooms Tab ────────────────────────────────────────────────────────────────
function RoomsTab({ hostelId }: { hostelId: string }) {
  const qc = useQueryClient();
  const [showAddTenant, setShowAddTenant]     = useState(false);
  const [roomForm, setRoomForm]               = useState<{ room: Record<string, unknown> | null; floorId?: string } | null>(null);
  const [showAddFloor, setShowAddFloor]       = useState(false);
  const [floorMenu, setFloorMenu]             = useState<{ id: string; name: string } | null>(null);
  const [renameFloor, setRenameFloor]         = useState<{ id: string; name: string } | null>(null);
  const [collapsed, setCollapsed]             = useState<Set<string>>(new Set());
  const [roomError, setRoomError]             = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.rooms.list(hostelId) });
    qc.invalidateQueries({ queryKey: ['floors', hostelId] });
  };

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

  const createRoomMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      import('@features/rooms/api').then((m) => m.roomService.create(hostelId, data)),
    onSuccess: () => { invalidate(); setRoomForm(null); },
    onError: (e: any) => setRoomError(e?.response?.data?.error?.message ?? 'Failed to create room'),
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      import('@features/rooms/api').then((m) => m.roomService.update(id, data)),
    onSuccess: () => { invalidate(); setRoomForm(null); },
    onError: (e: any) => setRoomError(e?.response?.data?.error?.message ?? 'Failed to update room'),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: string) =>
      import('@features/rooms/api').then((m) => m.roomService.delete(id)),
    onSuccess: () => { invalidate(); setRoomForm(null); },
    onError: (e: any) => setRoomError(e?.response?.data?.error?.message ?? 'Cannot delete room with active tenants'),
  });

  const addFloorMutation = useMutation({
    mutationFn: async (name: string) =>
      import('@features/rooms/api').then((m) => m.floorService.create(hostelId, { name })),
    onSuccess: () => { invalidate(); setShowAddFloor(false); },
  });

  const renameFloorMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      import('@features/rooms/api').then((m) => m.floorService.update(id, { name })),
    onSuccess: () => { invalidate(); setRenameFloor(null); },
  });

  const deleteFloorMutation = useMutation({
    mutationFn: async (id: string) =>
      import('@features/rooms/api').then((m) => m.floorService.delete(id)),
    onSuccess: () => { invalidate(); setFloorMenu(null); },
    onError: (e: any) => {
      setFloorMenu(null);
      setRoomError(e?.response?.data?.error?.message ?? 'Cannot delete floor with rooms');
    },
  });

  if (isLoading) return <TabSkeleton />;
  if (isError)   return <TabError onRetry={refetch} />;

  const rooms: Record<string, unknown>[] = Array.isArray(roomsData) ? roomsData : [];
  const floors: Record<string, unknown>[] = Array.isArray(floorsData) ? floorsData : [];

  const floorGroups: Map<string, { id: string; name: string; sort: number; rooms: Record<string, unknown>[] }> = new Map();
  rooms.forEach((room) => {
    const fid   = String(room.floor_id ?? '__none');
    const fname = String(room.floor_name ?? (room.floor_id ? 'Floor' : 'Unassigned'));
    const fsort = Number(room.floor_sort_order ?? 999);
    if (!floorGroups.has(fid)) floorGroups.set(fid, { id: fid, name: fname, sort: fsort, rooms: [] });
    floorGroups.get(fid)!.rooms.push(room);
  });
  floors.forEach((f) => {
    const fid = String(f.id);
    if (!floorGroups.has(fid))
      floorGroups.set(fid, { id: fid, name: String(f.name), sort: Number(f.sort_order ?? 0), rooms: [] });
  });

  const groups     = Array.from(floorGroups.values()).sort((a, b) => a.sort - b.sort);
  const totalBeds  = rooms.reduce((s, r) => s + Number(r.capacity ?? 0), 0);
  const totalOccupied = rooms.reduce((s, r) => s + Number(r.occupied_count ?? 0), 0);
  const totalVacant   = rooms.filter((r) => String(r.status) === 'vacant').length;

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const roomSaving   = createRoomMutation.isPending || updateRoomMutation.isPending;
  const roomDeleting = deleteRoomMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Error toast */}
      {roomError && (
        <div className="flex items-center justify-between gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <span className="text-xs text-destructive">{roomError}</span>
          <button onClick={() => setRoomError(null)} className="text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

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
      {groups.length === 0 && rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
            <BedDouble className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No rooms yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add a floor then add rooms to it</p>
          </div>
        </div>
      ) : groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        const groupVacant = group.rooms.filter((r) => String(r.status) === 'vacant').length;
        const isReal      = group.id !== '__none';
        return (
          <div key={group.id}>
            {/* Floor header row */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleCollapse(group.id)}
                className="flex-1 flex items-center gap-2 py-2 touch-manipulation min-w-0"
              >
                <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground truncate">{group.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{group.rooms.length} rooms</span>
                {groupVacant > 0 && (
                  <span className="text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] px-1.5 py-0.5 rounded-full font-medium shrink-0">{groupVacant} vacant</span>
                )}
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />}
              </button>
              {isReal && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFloorMenu({ id: group.id, name: group.name }); }}
                  className="p-1.5 text-muted-foreground active:scale-90 shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
            </div>

            {!isCollapsed && (
              <div className="space-y-2">
                {group.rooms.map((room) => {
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
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              occupied === 0        ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                              : occupied < capacity ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#10B981]/10 text-[#10B981]'
                            }`}>{occupied}/{capacity} beds</span>
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
                          onClick={() => setRoomForm({ room })}
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

                {/* Add Room to this floor */}
                <button
                  onClick={() => setRoomForm({ room: null, floorId: isReal ? group.id : '' })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground active:text-foreground transition-colors touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Room
                </button>
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

      {/* Modals */}
      {showAddTenant && <AddTenantModal hostelId={hostelId} onClose={() => setShowAddTenant(false)} />}

      {showAddFloor && (
        <FloorNameModal
          title="Add Floor"
          submitLabel="Add Floor"
          onClose={() => setShowAddFloor(false)}
          onSubmit={(name) => addFloorMutation.mutate(name)}
          busy={addFloorMutation.isPending}
        />
      )}

      {renameFloor && (
        <FloorNameModal
          title="Rename Floor"
          initialName={renameFloor.name}
          submitLabel="Save"
          onClose={() => setRenameFloor(null)}
          onSubmit={(name) => renameFloorMutation.mutate({ id: renameFloor.id, name })}
          busy={renameFloorMutation.isPending}
        />
      )}

      {floorMenu && (
        <FloorActionsSheet
          floor={floorMenu}
          onClose={() => setFloorMenu(null)}
          onRename={() => setRenameFloor(floorMenu)}
          onDelete={() => deleteFloorMutation.mutate(floorMenu.id)}
          deleting={deleteFloorMutation.isPending}
        />
      )}

      {roomForm !== null && (
        <RoomFormModal
          room={roomForm.room}
          defaultFloorId={roomForm.floorId}
          floors={floors}
          onClose={() => { setRoomForm(null); setRoomError(null); }}
          onSave={(data) => {
            setRoomError(null);
            if (roomForm.room) {
              updateRoomMutation.mutate({ id: String(roomForm.room.id), data });
            } else {
              createRoomMutation.mutate(data);
            }
          }}
          onDelete={roomForm.room ? () => deleteRoomMutation.mutate(String(roomForm.room!.id)) : undefined}
          saving={roomSaving}
          deleting={roomDeleting}
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

      <Link
        to={`/hostels/${hostelId}/tenants`}
        className="flex items-center justify-between p-3 rounded-xl border border-accent/30 bg-accent/5 text-sm font-medium text-accent"
      >
        Manage all tenants
        <ChevronRight className="w-4 h-4" />
      </Link>

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
  const queryClient = useQueryClient();
  const [range, setRange] = useState('month');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const params = useMemo(
    () => ({
      range,
      status,
      sort,
      search,
      categories: selectedCategories.join(','),
      limit: 40,
    }),
    [range, search, selectedCategories, sort, status],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.list(hostelId), params],
    queryFn: () =>
      import('@features/expenses/api').then((m) => m.expenseService.getAll(hostelId, params)),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const payload = (data || {}) as Record<string, any>;
  const expenses: Record<string, any>[] = Array.isArray(payload.expenses) ? payload.expenses : [];
  const kpis = payload.kpis || {};
  const categories = Array.isArray(payload.category_breakdown) ? payload.category_breakdown : [];
  const insights = Array.isArray(payload.insights) ? payload.insights : [];
  const monthlyTrend = Array.isArray(payload.monthly_trend) ? payload.monthly_trend : [];
  const occupancy = payload.occupancy_impact || {};
  const allCategories: string[] = payload.meta?.categories || EXPENSE_CATEGORIES;
  const maxCategory = Math.max(...categories.map((c: any) => Number(c.amount || 0)), 1);
  const maxTrend = Math.max(
    ...monthlyTrend.map((m: any) => Math.max(Number(m.revenue || 0), Number(m.expenses || 0), Number(m.profit || 0))),
    1,
  );

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(hostelId, body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      setShowAddExpense(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      import('@features/expenses/api').then((m) => m.expenseService.update(id, body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => import('@features/expenses/api').then((m) => m.expenseService.delete(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) }),
  });

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  };

  return (
    <div className="relative space-y-5 pb-24">
      <div className="sticky top-[92px] z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <ExpenseKpi
            label="This Month Expenses"
            value={fmt(kpis.this_month_expenses)}
            sub={`${Math.abs(Number(kpis.expense_growth_rate || 0)).toFixed(0)}% ${Number(kpis.expense_growth_rate || 0) >= 0 ? 'vs last month' : 'lower'}`}
            state={Number(kpis.expense_growth_rate || 0) > 20 ? 'dangerous' : Number(kpis.expense_growth_rate || 0) > 5 ? 'warning' : 'healthy'}
            trend={Number(kpis.expense_growth_rate || 0)}
          />
          <ExpenseKpi
            label="Net Profit"
            value={fmt(kpis.net_profit)}
            sub={`${Number(kpis.profit_margin || 0).toFixed(0)}% margin`}
            state={String(kpis.health || 'healthy')}
          />
          <ExpenseKpi
            label="Expense / Tenant"
            value={fmt(kpis.expense_per_tenant)}
            sub="operational load"
            state={Number(kpis.expense_per_tenant || 0) > 10000 ? 'warning' : 'healthy'}
          />
          <ExpenseKpi
            label="Expense Ratio"
            value={`${Number(kpis.expense_revenue_ratio || 0).toFixed(0)}%`}
            sub="of revenue consumed"
            state={String(kpis.expense_ratio_health || 'healthy')}
          />
        </div>
      </div>

      <section className="space-y-3">
        <SectionTitle title="Expense Intelligence" sub="Where money is moving and what needs attention" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Category Breakdown</h3>
              <span className="text-[10px] text-muted-foreground">This month</span>
            </div>
            {categories.length === 0 ? (
              <EmptyMini text="Add expenses to reveal category leakage." />
            ) : (
              <div className="space-y-3">
                {categories.slice(0, 8).map((cat: any) => (
                  <div key={String(cat.category)}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <span className="font-medium text-foreground">{cat.category}</span>
                      <span className="text-muted-foreground">
                        {fmt(cat.amount)} · {Number(cat.percentage || 0).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${categoryTone(cat.category).bar}`}
                        style={{ width: `${Math.max(4, (Number(cat.amount || 0) / maxCategory) * 100)}%` }}
                      />
                    </div>
                    {cat.anomaly && (
                      <div className="mt-1 text-[10px] font-medium text-warning">{cat.anomaly}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Health Insights</h3>
            </div>
            <div className="space-y-2">
              {insights.map((insight: any, i: number) => (
                <div key={`${insight.title}-${i}`} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${severityDot(insight.severity)}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Revenue · Expense · Profit</h3>
            <div className="space-y-3">
              {monthlyTrend.map((m: any) => (
                <div key={String(m.month)} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{String(m.month)}</span>
                    <span>{fmt(m.profit)} profit</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 h-8 items-end">
                    <TrendBar value={Number(m.revenue || 0)} max={maxTrend} className="bg-success" />
                    <TrendBar value={Number(m.expenses || 0)} max={maxTrend} className="bg-destructive" />
                    <TrendBar value={Math.max(0, Number(m.profit || 0))} max={maxTrend} className="bg-accent" />
                  </div>
                </div>
              ))}
              <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-success" />Revenue</span>
                <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-destructive" />Expenses</span>
                <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-accent" />Profit</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Occupancy Impact</h3>
            <div className="grid grid-cols-2 gap-3">
              <ImpactMetric label="Occupancy" value={`${Number(occupancy.occupancy_rate || 0).toFixed(0)}%`} />
              <ImpactMetric label="Expense / Bed" value={fmt(occupancy.expense_per_occupied_bed)} />
              <ImpactMetric label="Vacancy Loss" value={fmt(occupancy.vacancy_loss_estimate)} />
              <ImpactMetric label="Fixed Cost" value={`${Number(occupancy.fixed_cost_pressure || 0).toFixed(0)}%`} />
            </div>
            <div className="mt-4 rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-foreground">
              {occupancy.message || 'Occupancy and cost pressure will appear as snapshots build.'}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Expense Ledger" sub={`${payload.total || expenses.length} records`} />
        <div className="sticky top-[260px] z-[9] -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-y border-border space-y-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`shrink-0 px-3 py-2 rounded-full text-xs font-semibold border ${
                  range === value ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
              <option value="recent">Recent</option>
              <option value="highest">Highest Amount</option>
              <option value="oldest">Oldest</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, vendor, notes"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {allCategories.slice(0, 12).map((category) => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${
                  selectedCategories.includes(category)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {expenses.length === 0 ? (
          <ExpenseEmptyState onAdd={() => setShowAddExpense(true)} />
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <ExpenseCard
                key={String(expense.id)}
                expense={expense}
                onDuplicate={() => setShowAddExpense(true)}
                onMarkPending={() => updateMutation.mutate({ id: String(expense.id), body: { status: 'pending' } })}
                onDelete={() => deleteMutation.mutate(String(expense.id))}
              />
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setShowAddExpense(true)}
        className="fixed right-5 bottom-6 z-20 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center active:scale-95"
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showAddExpense && (
        <AddExpenseModal
          categories={allCategories}
          loading={createMutation.isPending}
          onClose={() => setShowAddExpense(false)}
          onSubmit={(body) => createMutation.mutate(body)}
        />
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  'Food',
  'Electricity',
  'Water',
  'Internet',
  'Staff Salary',
  'Maintenance',
  'Repairs',
  'Cleaning',
  'Security',
  'Furniture',
  'Kitchen',
  'Marketing',
  'Transport',
  'Miscellaneous',
];

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ExpenseKpi({ label, value, sub, state, trend }: { label: string; value: string; sub: string; state: string; trend?: number }) {
  const color = state === 'dangerous' ? 'text-destructive' : state === 'warning' ? 'text-warning' : 'text-success';
  return (
    <div className="bg-card border border-border rounded-xl p-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{label}</p>
        {trend !== undefined ? (
          trend >= 0 ? <TrendingUp className={`w-3.5 h-3.5 ${color}`} /> : <TrendingDown className="w-3.5 h-3.5 text-success" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${state === 'dangerous' ? 'bg-destructive' : state === 'warning' ? 'bg-warning' : 'bg-success'}`} />
        )}
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function categoryTone(category: string) {
  const tones: Record<string, { chip: string; bar: string }> = {
    Food: { chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
    Electricity: { chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
    Water: { chip: 'bg-info/10 text-info', bar: 'bg-info' },
    Internet: { chip: 'bg-accent/10 text-accent', bar: 'bg-accent' },
    Maintenance: { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  };
  return tones[category] || { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' };
}

function severityDot(severity: string) {
  if (severity === 'dangerous') return 'bg-destructive';
  if (severity === 'warning') return 'bg-warning';
  return 'bg-success';
}

function TrendBar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-8 flex items-end rounded bg-muted/40 overflow-hidden">
      <div className={`w-full rounded-t ${className}`} style={{ height: `${Math.max(5, (value / max) * 100)}%` }} />
    </div>
  );
}

function ImpactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function ExpenseEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
        <Zap className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-foreground">Start tracking hostel operations</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Track electricity, food, maintenance and staff costs to understand profitability.
      </p>
      <div className="mt-4 grid gap-2 text-left text-xs text-muted-foreground">
        <div className="rounded-lg bg-background border border-border p-3">Food cost vs revenue insight</div>
        <div className="rounded-lg bg-background border border-border p-3">Expense per occupied bed</div>
        <div className="rounded-lg bg-background border border-border p-3">Profit margin warnings</div>
      </div>
      <button onClick={onAdd} className="mt-5 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold">
        Add First Expense
      </button>
    </div>
  );
}

function ExpenseCard({
  expense,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{String(expense.title || 'Expense')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${tone.chip}`}>{String(expense.category || 'Misc')}</span>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {expense.date ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No date'}
            </span>
            {expense.is_recurring && (
              <span className="text-[10px] text-accent inline-flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                Recurring
              </span>
            )}
          </div>
          {(expense.notes || expense.vendor_name || expense.hostel) && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {[expense.vendor_name, expense.notes, expense.hostel].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-foreground">{fmt(expense.amount)}</p>
          <p className={`mt-1 text-[10px] font-semibold ${expense.status === 'paid' ? 'text-success' : expense.status === 'cancelled' ? 'text-destructive' : 'text-warning'}`}>
            {String(expense.status || 'paid').toUpperCase()}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button onClick={onDuplicate} className="rounded-lg border border-border py-2 text-[10px] font-semibold text-muted-foreground">Duplicate</button>
        <button onClick={onMarkPending} className="rounded-lg border border-border py-2 text-[10px] font-semibold text-muted-foreground">Mark Pending</button>
        <button onClick={onDelete} className="rounded-lg border border-destructive/20 py-2 text-[10px] font-semibold text-destructive">Delete</button>
      </div>
    </div>
  );
}

function AddExpenseModal({
  categories,
  loading,
  onClose,
  onSubmit,
}: {
  categories: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Miscellaneous',
    date: new Date().toISOString().slice(0, 10),
    status: 'paid',
    notes: '',
    payment_method: '',
    vendor_name: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const suggestion = form.title ? suggestExpenseCategory(form.title) : '';

  const submit = () => {
    if (!form.title.trim() || !Number(form.amount) || !form.category || !form.date) return;
    onSubmit({
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      category: form.category,
      notes: form.notes.trim() || undefined,
      vendor_name: form.vendor_name.trim() || undefined,
      payment_method: form.payment_method || undefined,
      receipt_image: receiptFile || undefined,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      expense_type: ['Internet', 'Security', 'Staff Salary', 'Salary'].includes(form.category) ? 'FIXED' : 'VARIABLE',
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border p-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Add Expense</h3>
            <p className="text-xs text-muted-foreground">Fast entry for daily operations</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, category: f.category === 'Miscellaneous' ? suggestExpenseCategory(title) : f.category }));
            }}
            placeholder="Title, e.g. EB Bill"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          {suggestion && (
            <button
              onClick={() => setForm((f) => ({ ...f, category: suggestion }))}
              className="text-[10px] font-semibold text-accent"
            >
              Suggested category: {suggestion}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Amount"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
          </div>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              placeholder="Payment method"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
          </div>
          <input
            value={form.vendor_name}
            onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
            placeholder="Vendor name"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            rows={3}
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none"
          />
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-muted/40">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {receiptFile ? receiptFile.name : 'Attach receipt image'}
              </p>
              <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP under 4MB</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
            <span className="text-sm font-medium text-foreground">Recurring expense</span>
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
            />
          </label>
          {form.is_recurring && (
            <select value={form.recurring_frequency} onChange={(e) => setForm((f) => ({ ...f, recurring_frequency: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </div>

        <button
          onClick={submit}
          disabled={loading || !form.title.trim() || !Number(form.amount)}
          className="mt-5 w-full py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Expense'}
        </button>
      </div>
    </div>
  );
}

function suggestExpenseCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bill)/.test(text)) return 'Electricity';
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal)/.test(text)) return 'Food';
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return 'Internet';
  if (/(repair|plumb|paint|fix|carpenter)/.test(text)) return 'Repairs';
  if (/(clean|housekeep)/.test(text)) return 'Cleaning';
  if (/(salary|staff|warden|watchman)/.test(text)) return 'Staff Salary';
  if (/(water|tanker)/.test(text)) return 'Water';
  return 'Miscellaneous';
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
