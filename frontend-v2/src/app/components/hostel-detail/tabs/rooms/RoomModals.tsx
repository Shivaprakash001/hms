import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight, Loader2, Pencil, Phone, Repeat2, Trash2, Users, Wifi, X } from 'lucide-react';
import { fmt } from '../../shared/format';

export function RoomFormModal({
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

export function FloorNameModal({
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

export function FloorActionsSheet({
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

interface RoomOverviewModalProps {
  hostelId: string;
  roomId: string;
  onClose: () => void;
  onEditRoom: (room: Record<string, unknown>) => void;
  onTransferTenant: (tenantId: string) => void;
}

export function RoomOverviewModal({ hostelId, roomId, onClose, onEditRoom, onTransferTenant }: RoomOverviewModalProps) {
  const { data: overviewRaw, isLoading, error } = useQuery({
    queryKey: ['room', 'overview', roomId],
    queryFn: () => import('@features/rooms/api').then((m) => m.roomService.getOverview(roomId)),
  });

  const overview = overviewRaw?.data ?? overviewRaw;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/20" onClick={onClose}>
        <div className="w-full bg-card rounded-t-2xl border-t border-border p-8 flex flex-col items-center justify-center min-h-[30vh]" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="w-8 h-8 animate-spin text-accent mb-2" />
          <p className="text-sm text-muted-foreground">Loading room overview...</p>
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/20" onClick={onClose}>
        <div className="w-full bg-card rounded-t-2xl border-t border-border p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-foreground font-semibold">Failed to load room overview</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-secondary rounded-xl text-xs font-semibold">Close</button>
        </div>
      </div>
    );
  }

  const room = overview.room ?? {};
  const tenants = Array.isArray(overview.tenants) ? overview.tenants : [];
  const payments = Array.isArray(overview.payments) ? overview.payments : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-card rounded-t-2xl border-t border-border max-h-[85dvh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-bold text-foreground text-sm">Room {room.room_no || 'Overview'}</h2>
            <p className="text-[10px] text-muted-foreground">
              Floor {room.floor ?? 0} · {room.occupied ?? 0}/{room.capacity ?? 1} Beds Occupied
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground active:scale-90 hover:bg-secondary rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Rent & Dues Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-medium">Monthly Rent</span>
              <span className="text-sm font-bold text-foreground">{fmt(room.base_rent ?? room.monthly_rent ?? 0)}</span>
            </div>
            <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-medium">Pending Room Dues</span>
              <span className={`text-sm font-bold ${Number(overview.pending_dues ?? 0) > 0 ? 'text-destructive' : 'text-accent'}`}>
                {fmt(overview.pending_dues ?? 0)}
              </span>
            </div>
          </div>

          {/* Tenants Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Residents</h3>
              {tenants.length < (room.capacity ?? 1) && (
                <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                  {Number(room.capacity ?? 1) - tenants.length} Bed(s) Available
                </span>
              )}
            </div>

            {tenants.length === 0 ? (
              <div className="p-6 border border-dashed border-border rounded-xl text-center">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-60" />
                <p className="text-xs text-muted-foreground font-medium">No tenants currently allocated to this room</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tenants.map((t: any) => (
                  <div key={t.tenant_id} className="p-3 rounded-xl border border-border bg-secondary/10 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs shrink-0">
                          {t.name ? t.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'T'}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-foreground">{t.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{t.phone || 'No phone'}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Rent: <span className="font-semibold text-foreground">{fmt(t.rent ?? room.base_rent ?? 0)}/mo</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          t.payment_status === 'PAID' ? 'bg-[#10B981]/10 text-[#047857]' : 'bg-[#F59E0B]/10 text-[#B45309]'
                        }`}>
                          {t.payment_status || 'PENDING'}
                        </span>
                        {t.pending_dues > 0 && (
                          <p className="text-[10px] font-semibold text-destructive mt-1">Dues: {fmt(t.pending_dues)}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Joined: {new Date(t.joined_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <button
                        type="button"
                        onClick={() => onTransferTenant(t.tenant_id)}
                        className="flex items-center gap-1 text-accent font-semibold hover:underline"
                      >
                        <Repeat2 className="w-3 h-3" /> Shift / Re-allocate Room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments Section */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Room Payments</h3>
              <div className="bg-secondary/10 border border-border rounded-xl divide-y divide-border/40">
                {payments.slice(0, 3).map((p: any, idx: number) => (
                  <div key={idx} className="p-2 flex items-center justify-between text-[10px]">
                    <div>
                      <p className="font-medium text-foreground">{p.tenant_name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="font-semibold text-[#047857]">{fmt(p.amount_paid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit / Quick actions footer */}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditRoom(room);
              }}
              className="flex-1 py-2 rounded-xl border border-border font-semibold text-xs text-foreground bg-card hover:bg-secondary/40 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit Room Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

