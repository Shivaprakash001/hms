import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, BedDouble, Receipt, AlertCircle, Plus, CreditCard, Phone, Wifi, FileText, Eye, EyeOff, Copy, Check, Pencil, Layers, ChevronDown, ChevronRight, X, Trash2, MoreVertical, TrendingUp, TrendingDown, Sparkles, Search, CalendarDays, Repeat2, Upload, Zap, Activity, AlertTriangle, BellRing, ClipboardCheck, Flame, Home, IndianRupee, Megaphone, UserPlus, Send, Loader2 } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { fmt } from '../shared/format';
import { TabError, TabSkeleton } from '../shared/TabStates';

const AddTenantModal = lazy(() => import('../../modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal })));
const TransferRoomSheet = lazy(() => import('@features/tenants/components/allocation/TransferRoomSheet').then((m) => ({ default: m.TransferRoomSheet })));
const RoomFormModal = lazy(() => import('./rooms/RoomModals').then((m) => ({ default: m.RoomFormModal })));
const FloorNameModal = lazy(() => import('./rooms/RoomModals').then((m) => ({ default: m.FloorNameModal })));
const FloorActionsSheet = lazy(() => import('./rooms/RoomModals').then((m) => ({ default: m.FloorActionsSheet })));
const RoomOverviewModal = lazy(() => import('./rooms/RoomModals').then((m) => ({ default: m.RoomOverviewModal }))); 

function BedOccupancyBlocks({ occupied, capacity, hasDues = false }: { occupied: number; capacity: number; hasDues?: boolean }) {
  const beds = Array.from({ length: Math.max(1, capacity || 1) });
  return (
    <div className="flex flex-wrap gap-1.5">
      {beds.map((_, index) => {
        const filled = index < occupied;
        return (
          <span
            key={index}
            className={[
              'h-5 w-4 rounded-[4px] border',
              filled && hasDues ? 'border-[#F59E0B] bg-[#F59E0B]' : '',
              filled && !hasDues ? 'border-[#10B981] bg-[#10B981]' : '',
              !filled ? 'border-border bg-background' : '',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

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

export function RoomsTab({ hostelId }: { hostelId: string }) {
  const qc = useQueryClient();
  const [assignTenantRoomId, setAssignTenantRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm]               = useState<{ room: Record<string, unknown> | null; floorId?: string } | null>(null);
  const [showAddFloor, setShowAddFloor]       = useState(false);
  const [floorMenu, setFloorMenu]             = useState<{ id: string; name: string } | null>(null);
  const [renameFloor, setRenameFloor]         = useState<{ id: string; name: string } | null>(null);
  const [collapsed, setCollapsed]             = useState<Set<string>>(new Set());
  const [roomError, setRoomError]             = useState<string | null>(null);

  const [selectedRoomOverviewId, setSelectedRoomOverviewId] = useState<string | null>(null);
  const [selectedTransferTenantId, setSelectedTransferTenantId] = useState<string | null>(null);

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

  const rooms: Record<string, unknown>[] = Array.isArray(roomsData) ? roomsData : [];
  const floors: Record<string, unknown>[] = Array.isArray(floorsData) ? floorsData : [];

  const roomSummary = useMemo(() => {
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

    return {
      groups: Array.from(floorGroups.values()).sort((a, b) => a.sort - b.sort),
      totalBeds: rooms.reduce((s, r) => s + Number(r.capacity ?? 0), 0),
      totalOccupied: rooms.reduce((s, r) => s + Number(r.occupied_count ?? 0), 0),
      totalVacant: rooms.filter((r) => String(r.status) === 'vacant').length,
    };
  }, [floors, rooms]);

  if (isLoading) return <TabSkeleton />;
  if (isError)   return <TabError onRetry={refetch} />;

  const { groups, totalBeds, totalOccupied, totalVacant } = roomSummary;

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
                  const hasVacantBed = occupied < capacity;
                  const roomDues = Number(room.outstanding_dues ?? room.due_amount ?? room.pending_dues ?? 0);
                  const vacantBeds = Math.max(0, capacity - occupied);
                  const tenants = Array.isArray(room.tenants) ? (room.tenants as Record<string, unknown>[]) : [];
                  const tenantNames = tenants
                    .map((tenant) => String(tenant.name ?? '').trim())
                    .filter(Boolean);
                  return (
                    <div
                      key={String(room.id)}
                      className={`bg-card border rounded-xl p-3.5 min-w-0 ${
                        roomDues > 0 ? 'border-[#F59E0B]/50'
                        : !isOccupied ? 'border-[#3B82F6]/15'
                        : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 cursor-pointer hover:opacity-80" onClick={() => setSelectedRoomOverviewId(String(room.id))}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{String(room.room_no)}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              roomDues > 0          ? 'bg-[#F59E0B]/10 text-[#B45309]'
                              : occupied === 0      ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                              : occupied < capacity ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#10B981]/10 text-[#10B981]'
                            }`}>
                              {occupied}/{capacity} beds{roomDues > 0 ? ' · dues pending' : ''}
                            </span>
                          </div>
                          <div className="mt-2">
                            <BedOccupancyBlocks occupied={occupied} capacity={capacity} hasDues={roomDues > 0} />
                          </div>
                          {vacantBeds > 0 && (
                            <div className="text-[11px] text-muted-foreground mt-1">{vacantBeds} vacant bed{vacantBeds === 1 ? '' : 's'}</div>
                          )}
                          {isOccupied && tenantNames.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {tenants.slice(0, 3).map((tenant, index) => (
                                <div key={String(tenant.tenant_id ?? tenant.allocation_id ?? index)} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground truncate">{String(tenant.name ?? 'Tenant')}</span>
                                  <span className="font-semibold text-foreground shrink-0">{fmt(tenant.monthly_rent ?? room.base_rent ?? 0)}/mo</span>
                                </div>
                              ))}
                              {tenants.length > 3 && (
                                <div className="text-[11px] text-muted-foreground">+{tenants.length - 3} more residents</div>
                              )}
                            </div>
                          )}
                          {!isOccupied && (
                            <div className="text-xs text-muted-foreground mt-0.5">{fmt(room.monthly_rent ?? room.base_rent ?? 0)}/mo base rent</div>
                          )}
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
                      {hasVacantBed && (
                        <button
                          onClick={() => setAssignTenantRoomId(String(room.id))}
                          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 bg-card border border-border rounded-lg text-xs font-medium text-accent active:scale-95 transition-transform touch-manipulation"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {occupied === 0 ? 'Assign Tenant' : `Assign to ${vacantBeds} vacant bed${vacantBeds === 1 ? '' : 's'}`}
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
      {assignTenantRoomId && (
        <Suspense fallback={null}>
          <AddTenantModal
            hostelId={hostelId}
            preselectedRoomId={assignTenantRoomId}
            onClose={() => setAssignTenantRoomId(null)}
          />
        </Suspense>
      )}

      {showAddFloor && (
        <Suspense fallback={null}>
          <FloorNameModal
            title="Add Floor"
            submitLabel="Add Floor"
            onClose={() => setShowAddFloor(false)}
            onSubmit={(name) => addFloorMutation.mutate(name)}
            busy={addFloorMutation.isPending}
          />
        </Suspense>
      )}

      {renameFloor && (
        <Suspense fallback={null}>
          <FloorNameModal
            title="Rename Floor"
            initialName={renameFloor.name}
            submitLabel="Save"
            onClose={() => setRenameFloor(null)}
            onSubmit={(name) => renameFloorMutation.mutate({ id: renameFloor.id, name })}
            busy={renameFloorMutation.isPending}
          />
        </Suspense>
      )}

      {floorMenu && (
        <Suspense fallback={null}>
          <FloorActionsSheet
            floor={floorMenu}
            onClose={() => setFloorMenu(null)}
            onRename={() => setRenameFloor(floorMenu)}
            onDelete={() => deleteFloorMutation.mutate(floorMenu.id)}
            deleting={deleteFloorMutation.isPending}
          />
        </Suspense>
      )}

      {roomForm !== null && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {selectedRoomOverviewId && (
        <Suspense fallback={null}>
          <RoomOverviewModal
            hostelId={hostelId}
            roomId={selectedRoomOverviewId}
            onClose={() => setSelectedRoomOverviewId(null)}
            onEditRoom={(room) => setRoomForm({ room })}
            onTransferTenant={(tenantId) => setSelectedTransferTenantId(tenantId)}
          />
        </Suspense>
      )}

      {selectedTransferTenantId && (
        <Suspense fallback={null}>
          <TransferRoomSheet
            hostelId={hostelId}
            tenantId={selectedTransferTenantId}
            onClose={() => setSelectedTransferTenantId(null)}
            onSuccess={() => {
              setSelectedTransferTenantId(null);
              invalidate();
              if (selectedRoomOverviewId) {
                qc.invalidateQueries({ queryKey: ['room', 'overview', selectedRoomOverviewId] });
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
