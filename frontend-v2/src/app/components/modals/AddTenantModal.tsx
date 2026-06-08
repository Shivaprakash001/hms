import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, User, BedDouble, Calendar, ChevronDown, ChevronRight, Copy, Check, Loader2, IndianRupee, RotateCcw, Building2 } from 'lucide-react';
import { ownerService } from '@domains/hostels/api';
import { roomService } from '@domains/rooms/api';
import { tenantService } from '@domains/tenants/api';
import { queryKeys } from '@lib/queryKeys';

interface AddTenantModalProps {
  onClose: () => void;
  hostelId?: string;
  preselectedRoomId?: string;
}

type MtType = 'MONTHLY' | 'ONE_TIME' | 'NONE';
type Overrides = { monthly_rent?: number; advance_deposit?: number; maintenance_charge?: number };

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const inp = 'w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent';

export function AddTenantModal({ onClose, hostelId, preselectedRoomId }: AddTenantModalProps) {
  const qc = useQueryClient();

  const [selectedHostelId, setSelectedHostelId] = useState(hostelId ?? '');
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [roomId, setRoomId]           = useState(preselectedRoomId ?? '');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentFrequency, setPaymentFrequency] = useState('MONTHLY');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [advanceDeposit, setAdvanceDeposit] = useState('');
  const [maintenanceCharge, setMaintenanceCharge] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<MtType>('MONTHLY');
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [link, setLink]               = useState('');
  const [copied, setCopied]           = useState(false);

  const { data: hostelsRaw = [] } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60 * 1000,
  });

  const hostels = Array.isArray(hostelsRaw)
    ? hostelsRaw
    : Array.isArray((hostelsRaw as any)?.hostels)
      ? (hostelsRaw as any).hostels
      : [];

  useEffect(() => {
    if (!selectedHostelId && hostels.length > 0) {
      setSelectedHostelId(String(hostels[0].id ?? hostels[0].hostel_id));
    }
  }, [hostels, selectedHostelId]);

  useEffect(() => {
    const selectedHostel = hostels.find((h: any) => String(h.id ?? h.hostel_id) === selectedHostelId);
    if (selectedHostel?.rent_cycle) {
      setPaymentFrequency(selectedHostel.rent_cycle);
    } else {
      setPaymentFrequency('MONTHLY');
    }
  }, [selectedHostelId, hostels]);

  useEffect(() => {
    if (hostelId) setSelectedHostelId(hostelId);
  }, [hostelId]);

  useEffect(() => {
    if (preselectedRoomId) setRoomId(preselectedRoomId);
  }, [preselectedRoomId]);

  // ── Available rooms (ACTIVE + has free beds) ─────────────────────────────
  const { data: roomsRaw = [] } = useQuery({
    queryKey: queryKeys.rooms.list(selectedHostelId),
    queryFn: () => roomService.getAll(selectedHostelId),
    enabled: Boolean(selectedHostelId),
    staleTime: 2 * 60 * 1000,
  });
  const rooms: Record<string, any>[] = Array.isArray(roomsRaw) ? roomsRaw : [];
  const availableRooms = rooms.filter((r) => {
    const st = String(r.status ?? '').toUpperCase();
    if (st === 'MAINTENANCE' || st === 'BLOCKED') return false;
    return Number(r.occupied_count ?? 0) < Number(r.capacity ?? 1);
  });

  // ── Pricing defaults for selected room ───────────────────────────────────
  const { data: defaultsRaw, isFetching: pricingLoading } = useQuery({
    queryKey: ['invite-defaults', roomId],
    queryFn: () => roomService.getInviteDefaults(roomId),
    enabled: !!roomId,
    staleTime: 2 * 60 * 1000,
  });

  const rv: any = defaultsRaw?.data?.resolved_values ?? defaultsRaw?.resolved_values ?? null;
  const defaults = rv ? {
    monthly_rent:       Number(rv.monthly_rent ?? 0),
    advance_deposit:    Number(rv.advance_deposit ?? 0),
    maintenance_charge: Number(rv.maintenance_charge ?? 0),
    maintenance_type:   (rv.maintenance_type ?? 'MONTHLY') as MtType,
  } : null;

  // Auto-fill when defaults change
  useEffect(() => {
    if (defaults) {
      setMonthlyRent(String(defaults.monthly_rent));
      setAdvanceDeposit(String(defaults.advance_deposit));
      setMaintenanceCharge(String(defaults.maintenance_charge));
      setMaintenanceType(defaults.maintenance_type);
    } else {
      setMonthlyRent('');
      setAdvanceDeposit('');
      setMaintenanceCharge('');
      setMaintenanceType('MONTHLY');
    }
  }, [defaultsRaw, roomId]);

  const rentVal = Number(monthlyRent || 0);
  const depVal = Number(advanceDeposit || 0);
  const maintVal = Number(maintenanceCharge || 0);
  const totalDueAtMoveIn = rentVal + depVal + (maintenanceType === 'ONE_TIME' ? maintVal : 0);

  const isDirty = defaults && (
    Number(monthlyRent) !== defaults.monthly_rent ||
    Number(advanceDeposit) !== defaults.advance_deposit ||
    Number(maintenanceCharge) !== defaults.maintenance_charge ||
    maintenanceType !== defaults.maintenance_type
  );

  const handleReset = () => {
    if (defaults) {
      setMonthlyRent(String(defaults.monthly_rent));
      setAdvanceDeposit(String(defaults.advance_deposit));
      setMaintenanceCharge(String(defaults.maintenance_charge));
      setMaintenanceType(defaults.maintenance_type);
    }
  };

  // ── Invite mutation ───────────────────────────────────────────────────────
  const inviteMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tenantService.invite(data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(selectedHostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.list(selectedHostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(selectedHostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.portfolio.performance(6) });
      setLink(res?.activation_link ?? '');
      setSuccess(true);
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error?.message ??
        e?.response?.data?.message ??
        e?.message ??
        'Failed to send invitation';
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    inviteMutation.mutate({
      name:               name.trim(),
      phone:              phone.trim() || undefined,
      email:              email.trim().toLowerCase(),
      hostel_id:          selectedHostelId,
      room_id:            roomId,
      joining_date:       joiningDate,
      payment_frequency:  paymentFrequency,
      monthly_rent:       monthlyRent ? Number(monthlyRent) : undefined,
      advance_amount:     advanceDeposit ? Number(advanceDeposit) : undefined,
      maintenance_amount: maintenanceCharge ? Number(maintenanceCharge) : undefined,
      maintenance_type:   maintenanceType,
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
        <div className="w-full bg-card rounded-t-2xl border-t border-border p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-[#10B981]" />
            </div>
            <h3 className="font-semibold text-foreground">Invitation sent!</h3>
            <p className="text-xs text-muted-foreground text-center">
              Email sent to <span className="text-foreground font-medium">{email}</span>. Share the activation link for WhatsApp or manual share.
            </p>
            {link && (
              <div className="w-full flex items-center gap-2 px-3 py-2.5 bg-secondary rounded-xl mt-1">
                <span className="flex-1 text-[11px] text-muted-foreground truncate font-mono">{link}</span>
                <button type="button" onClick={copyLink} className="shrink-0 text-muted-foreground active:scale-90 p-1">
                  {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
            <button onClick={onClose} className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold mt-2 active:scale-[0.98]">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card rounded-t-2xl border-t border-border max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 pt-4 pb-3 flex items-center justify-between z-10">
          <h2 className="font-semibold text-foreground text-sm">Invite Tenant</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground active:scale-90">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pt-4 pb-10 space-y-5">
          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <span className="text-xs text-destructive">{error}</span>
              <button type="button" onClick={() => setError(null)} className="shrink-0 text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── Section 1: Tenant ─────────────────────────────────── */}
          <div>
            <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="Tenant Details" />
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="e.g. Rahul Sharma" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765…" className={inp} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="tenant@email.com" className={inp} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Stay ───────────────────────────────────── */}
          <div>
            <SectionHeader icon={<BedDouble className="w-3.5 h-3.5" />} label="Stay Details" />
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Hostel *</span>
                </label>
                <select
                  value={selectedHostelId}
                  onChange={(e) => {
                    setSelectedHostelId(e.target.value);
                    setRoomId('');
                  }}
                  required
                  className={inp}
                >
                  <option value="">Select a hostel…</option>
                  {hostels.map((h: any) => (
                    <option key={String(h.id ?? h.hostel_id)} value={String(h.id ?? h.hostel_id)}>
                      {String(h.name ?? h.hostel_name ?? 'Hostel')}
                      {h.city ? ` · ${String(h.city)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Room *</label>
                <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required disabled={!selectedHostelId} className={inp}>
                  <option value="">{selectedHostelId ? 'Select a room…' : 'Select a hostel first…'}</option>
                  {availableRooms.map((r) => {
                    const occ   = Number(r.occupied_count ?? 0);
                    const cap   = Number(r.capacity ?? 1);
                    const floor = r.floor_name ? ` · ${r.floor_name}` : '';
                    return (
                      <option key={String(r.id)} value={String(r.id)}>
                        {String(r.room_no)}{floor} · {occ}/{cap} occupied
                      </option>
                    );
                  })}
                </select>
                {availableRooms.length === 0 && rooms.length > 0 && (
                  <p className="text-[11px] text-amber-500 mt-1">All rooms are fully occupied or unavailable.</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Joining Date *</span>
                </label>
                <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required className={inp} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Billing Frequency *</label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value)}
                  required
                  className={inp}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="HALF_YEARLY">Half Yearly</option>
                  <option value="ACADEMIC_YEARLY">Academic Yearly</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 3: Pricing & Financials ────────────────────── */}
          {roomId && (
            <div className={`space-y-4 transition-opacity ${pricingLoading ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <SectionHeader icon={<IndianRupee className="w-3.5 h-3.5" />} label="Pricing & Financials" />
                {isDirty && (
                  <button type="button" onClick={handleReset}
                    className="flex items-center gap-1 text-[10px] text-accent active:scale-95 font-medium mb-3">
                    <RotateCcw className="w-2.5 h-2.5" /> Reset to defaults
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Monthly Rent (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    required
                    placeholder="0"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Security Deposit (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    value={advanceDeposit}
                    onChange={(e) => setAdvanceDeposit(e.target.value)}
                    required
                    placeholder="0"
                    className={inp}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Maintenance (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={maintenanceCharge}
                    onChange={(e) => setMaintenanceCharge(e.target.value)}
                    placeholder="0"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Maintenance Type</label>
                  <select
                    value={maintenanceType}
                    onChange={(e) => setMaintenanceType(e.target.value as MtType)}
                    className={inp}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="ONE_TIME">One Time</option>
                    <option value="NONE">Waived (None)</option>
                  </select>
                </div>
              </div>

              {/* Summary card */}
              <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
                <div className="space-y-2">
                  <PricingRow label="Monthly Rent" value={rentVal} />
                  <PricingRow
                    label="Maintenance"
                    value={maintVal}
                    sub={
                      maintenanceType === 'MONTHLY' ? '/mo'
                      : maintenanceType === 'ONE_TIME' ? ' one-time'
                      : ' (waived)'
                    }
                  />
                  <PricingRow label="Security Deposit" value={depVal} />
                  <div className="border-t border-border/60 pt-2 mt-1">
                    <PricingRow label="Total due at move-in" value={totalDueAtMoveIn} bold />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={inviteMutation.isPending || !selectedHostelId || !roomId || !name.trim() || !email.trim()}
            className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {inviteMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending invite…</>
              : 'Send Invitation'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

function PricingRow({ label, value, sub = '', bold = false }: { label: string; value: number; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs ${bold ? 'font-semibold text-foreground' : 'text-foreground'}`}>
        {fmt(value)}{sub}
      </span>
    </div>
  );
}

// OverrideInput removed since pricing overrides are now primary input fields.
