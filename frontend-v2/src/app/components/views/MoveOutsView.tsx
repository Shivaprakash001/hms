import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeIndianRupee, CalendarDays, CheckCircle2, ClipboardCheck, Loader2, MessageSquare, Phone, DoorOpen, Plus, Trash2 } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { ownerService } from '@features/owners/api';
import { useTenantStore } from '@features/tenants/store/tenantStore';

const fmt = (n: unknown) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d: unknown) =>
  d ? new Date(String(d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

function tenantInfo(row: Record<string, unknown>) {
  const tenant = row.tenant as Record<string, unknown> | undefined;
  const profile = (tenant?.profiles ?? tenant?.profile ?? row.profile) as Record<string, unknown> | undefined;
  const allocation = Array.isArray(tenant?.room_allocations) ? tenant?.room_allocations?.[0] as Record<string, unknown> : undefined;
  const room = allocation?.room as Record<string, unknown> | undefined;

  return {
    name: String(row.tenant_name ?? profile?.name ?? row.name ?? 'Tenant'),
    phone: String(profile?.phone ?? tenant?.phone_1 ?? row.phone ?? ''),
    email: String(profile?.email ?? row.email ?? ''),
    room: String(room?.room_no ?? row.room_no ?? 'Unassigned'),
  };
}

function settlementSource(active: Record<string, unknown>) {
  return (active.settlement_preview ?? active.settlement ?? {}) as Record<string, unknown>;
}

export function MoveOutsView() {
  const { hostelId: paramHostelId } = useParams();
  const selectedHostelId = useTenantStore((s) => s.selectedHostelId);
  const setSelectedHostelId = useTenantStore((s) => s.setSelectedHostelId);

  // Load hostels
  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60_000,
  });

  const hostels = useMemo(() => {
    if (Array.isArray(hostelsRaw)) return hostelsRaw as Record<string, unknown>[];
    const obj = hostelsRaw as Record<string, unknown> | undefined;
    if (Array.isArray(obj?.hostels)) return obj!.hostels as Record<string, unknown>[];
    if (Array.isArray((obj?.data as Record<string, unknown>)?.hostels))
      return (obj!.data as Record<string, unknown>).hostels as Record<string, unknown>[];
    return [];
  }, [hostelsRaw]);

  const hostelId = paramHostelId || selectedHostelId || (hostels[0] ? String(hostels[0].id) : '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const [showInspectForm, setShowInspectForm] = useState(false);
  const [roomCondition, setRoomCondition] = useState('GOOD');
  const [cleaningStatus, setCleaningStatus] = useState('CLEAN');
  const [damagesAmount, setDamagesAmount] = useState('0');
  const [cleaningFee, setCleaningFee] = useState('0');
  const [missingItemsFee, setMissingItemsFee] = useState('0');
  const [otherDeductions, setOtherDeductions] = useState('0');
  const [deductionNotes, setDeductionNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [settlementDirection, setSettlementDirection] = useState('SETTLED');
  const [settlementAmount, setSettlementAmount] = useState('0');
  const [physicalExitDate, setPhysicalExitDate] = useState('');

  // Room Inspection Checklist states
  const [checkedRoom, setCheckedRoom] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState(false);
  const [checkedCupboard, setCheckedCupboard] = useState(false);
  const [checkedBelongings, setCheckedBelongings] = useState(false);

  // Damage items state
  const [damageItems, setDamageItems] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [newDamageName, setNewDamageName] = useState('');
  const [newDamageAmount, setNewDamageAmount] = useState('');

  const handleAddDamageItem = () => {
    if (!newDamageName.trim() || !newDamageAmount) return;
    const amount = Number(newDamageAmount) || 0;
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: newDamageName.trim(),
      amount,
    };
    const updatedList = [...damageItems, newItem];
    setDamageItems(updatedList);
    const sum = updatedList.reduce((acc, curr) => acc + curr.amount, 0);
    setDamagesAmount(String(sum));
    setNewDamageName('');
    setNewDamageAmount('');
  };

  const handleRemoveDamageItem = (id: string, amount: number) => {
    const updatedList = damageItems.filter((item) => item.id !== id);
    setDamageItems(updatedList);
    const sum = updatedList.reduce((acc, curr) => acc + curr.amount, 0);
    setDamagesAmount(String(sum));
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.moveOut.list(hostelId),
    queryFn: () => moveOutService.listRequests(hostelId),
    enabled: Boolean(hostelId),
  });

  const list = useMemo(
    () => (Array.isArray(data) ? data : ((data as Record<string, unknown>)?.requests ?? [])) as Record<string, unknown>[],
    [data]
  );

  const effectiveSelectedId = selectedId ?? (list[0]?.id ? String(list[0].id) : null);

  const { data: detail, isFetching: isDetailLoading } = useQuery({
    queryKey: queryKeys.moveOut.detail(hostelId, effectiveSelectedId ?? ''),
    queryFn: () => moveOutService.getRequest(effectiveSelectedId!),
    enabled: Boolean(effectiveSelectedId),
  });

  const active = (detail ?? list.find((r) => String(r.id) === effectiveSelectedId)) as Record<string, unknown> | undefined;
  const activeTenant = active ? tenantInfo(active) : null;
  const settlement = active ? settlementSource(active) : {};
  const inspection = (active?.inspection ?? {}) as Record<string, unknown>;
  const disputes = (active?.disputes ?? []) as Record<string, unknown>[];
  const direction = String(settlement.settlement_direction ?? settlement.direction ?? 'NONE');
  const netAmount = Number(settlement.net_settlement_amount ?? settlement.net_amount ?? 0);

  const depositHeld = Number(settlement.security_deposit_amount ?? 0) + Number(settlement.advance_balance ?? 0);
  const totalDue = Number(settlement.pending_rent_dues ?? 0) + Number(settlement.pending_late_fees ?? 0) + Number(settlement.pending_utility_dues ?? 0) + Number(settlement.total_deductions ?? 0);
  const netDiff = depositHeld - totalDue;

  useEffect(() => {
    if (!active) return;
    const nextDirection = direction === 'OWNER_OWES_TENANT' || direction === 'TENANT_OWES_OWNER' ? direction : 'SETTLED';
    setSettlementDirection(nextDirection);
    setSettlementAmount(String(Math.abs(netAmount || 0)));
    const exitDate = String(active.physical_exit_date ?? active.planned_exit_date ?? '').slice(0, 10);
    setPhysicalExitDate(exitDate);
    setCheckedRoom(false);
    setCheckedKeys(false);
    setCheckedCupboard(false);
    setCheckedBelongings(false);
    setDamageItems([]);
    setNewDamageName('');
    setNewDamageAmount('');
  }, [active?.id, active?.planned_exit_date, active?.physical_exit_date, direction, netAmount]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
  };

  const inspectMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      moveOutService.inspect(effectiveSelectedId!, payload),
    onSuccess: () => {
      toast.success('Inspection recorded');
      setShowInspectForm(false);
      setRoomCondition('GOOD');
      setCleaningStatus('CLEAN');
      setDamagesAmount('0');
      setCleaningFee('0');
      setMissingItemsFee('0');
      setOtherDeductions('0');
      setDeductionNotes('');
      setGeneralNotes('');
      invalidate();
    },
    onError: () => toast.error('Could not save inspection'),
  });

  const settleMutation = useMutation({
    mutationFn: () => moveOutService.settle(effectiveSelectedId!, {
      settlementDirection,
      confirmedSettlementAmount: Number(settlementAmount) || 0,
    }),
    onSuccess: () => {
      toast.success('Settlement approved');
      invalidate();
    },
    onError: () => toast.error('Could not approve settlement'),
  });

  const vacateMutation = useMutation({
    mutationFn: () => moveOutService.vacate(effectiveSelectedId!, {
      physicalExitDate,
    }),
    onSuccess: () => {
      toast.success('Tenant vacated and bed released');
      invalidate();
    },
    onError: () => toast.error('Could not record vacate action'),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      moveOutService.complete(effectiveSelectedId!, {
        paymentMethod,
        paymentReference,
        paymentNotes,
      }),
    onSuccess: () => {
      toast.success('Move-out completed');
      setPaymentReference('');
      setPaymentNotes('');
      invalidate();
    },
    onError: () => toast.error('Could not complete move-out'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => moveOutService.reject(effectiveSelectedId!),
    onSuccess: () => {
      toast.success('Move-out request rejected');
      invalidate();
    },
    onError: () => toast.error('Could not reject request'),
  });

  return (
    <TenantsLayout
      title="Move-outs"
      subtitle="Inspection, settlement, and exit workflow"
      backTo={paramHostelId ? `/hostels/${paramHostelId}/tenants` : '/tenants'}
    >
      <div className="space-y-4">
        {/* Hostel Selector (only if accessed globally and multiple hostels exist) */}
        {!paramHostelId && hostels.length > 1 && (
          <select
            value={hostelId}
            onChange={(e) => setSelectedHostelId(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {hostels.map((h) => (
              <option key={String(h.id)} value={String(h.id)}>
                {String(h.name ?? h.hostel_name ?? 'Hostel')}
              </option>
            ))}
          </select>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
            ))
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No move-out requests yet.
            </div>
          ) : (
            list.map((r) => {
              const info = tenantInfo(r);
              const selected = effectiveSelectedId === String(r.id);
              return (
                <button
                  key={String(r.id)}
                  type="button"
                  onClick={() => setSelectedId(String(r.id))}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selected ? 'border-accent bg-accent/5 shadow-sm' : 'border-border bg-card hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{info.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Room {info.room}</p>
                    </div>
                    <TenantStatusBadge status={String(r.status)} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 text-accent" />
                    Planned exit {fmtDate(r.planned_exit_date)}
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <section className="min-w-0">
          {!active ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Select a request to view inspection and settlement details.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Move-out request</p>
                      <h2 className="mt-1 text-xl font-bold text-foreground">{activeTenant?.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>Room {activeTenant?.room}</span>
                        {activeTenant?.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {activeTenant.phone}
                          </span>
                        )}
                        <span>Exit {fmtDate(active.planned_exit_date)}</span>
                      </div>
                    </div>
                    <TenantStatusBadge status={String(active.status)} size="md" />
                  </div>
                </div>

                {isDetailLoading ? (
                  <div className="space-y-3 p-4">
                    <div className="h-16 animate-pulse rounded-xl bg-secondary" />
                    <div className="h-32 animate-pulse rounded-xl bg-secondary" />
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {['REQUESTED', 'SETTLEMENT_PENDING', 'APPROVED'].includes(String(active.status)) && (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <DoorOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                              Future Vacancy Alert
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                              Room <span className="font-bold">{activeTenant?.room || 'N/A'}</span> will become vacant on {fmtDate(active.planned_exit_date)}.
                            </p>
                          </div>
                        </div>
                        <Link
                          to="/admissions"
                          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors shrink-0"
                        >
                          Find Replacement →
                        </Link>
                      </div>
                    )}

                    <MoveOutStepper request={active} hostelId={hostelId} />

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-accent/10 p-2 text-accent">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {String(active.status).replace(/_/g, ' ')}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {String(active.status) === 'REQUESTED'
                              ? `${activeTenant?.name} is waiting for room inspection.`
                              : String(active.status) === 'SETTLEMENT_PENDING'
                                ? 'Inspection is complete. Review and approve the final settlement.'
                                : String(active.status) === 'APPROVED'
                                  ? 'Settlement is approved. Release the bed and vacate the tenant.'
                                  : String(active.status) === 'VACATED'
                                    ? 'Tenant has physically vacated. Record the final refund or payment collection to complete the move-out.'
                                    : String(active.status) === 'COMPLETED'
                                      ? 'Move-out is complete and the room has been released.'
                                      : String(active.status) === 'REJECTED'
                                        ? 'This move-out request was rejected.'
                                        : 'Continue the next operational step below.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(active.inspection || ['SETTLEMENT_PENDING', 'APPROVED', 'VACATED', 'COMPLETED'].includes(String(active.status))) && (
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-accent" />
                          <h3 className="text-sm font-semibold text-foreground">Inspection summary</h3>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <Info label="Room condition" value={inspection.room_condition ?? '-'} />
                          <Info label="Cleaning status" value={inspection.cleaning_status ?? '-'} />
                          <Info label="Damage charges" value={fmt(inspection.damages_amount)} />
                          <Info label="Cleaning fee" value={fmt(inspection.cleaning_fee)} />
                          <Info label="Missing items" value={fmt(inspection.missing_items_fee)} />
                          <Info label="Other deductions" value={fmt(inspection.other_deductions)} />
                        </div>
                        {inspection.deduction_notes && (
                          <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                            {String(inspection.deduction_notes)}
                          </p>
                        )}
                      </div>
                    )}

                    {(active.settlement_preview || active.settlement) && (
                      <div className="rounded-2xl border border-border bg-background p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <BadgeIndianRupee className="h-4 w-4 text-accent" />
                          <h3 className="text-sm font-semibold text-foreground">Financial Settlement Ledger</h3>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Deposit Held */}
                          <div className="bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl p-3 space-y-2 border border-emerald-100/30">
                            <div className="flex justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              <span>Deposit Held (A)</span>
                              <span>{fmt(depositHeld)}</span>
                            </div>
                            <div className="space-y-1 pl-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                              <div className="flex justify-between">
                                <span>Security Deposit</span>
                                <span>{fmt(settlement.security_deposit_amount)}</span>
                              </div>
                              {Number(settlement.advance_balance) > 0 && (
                                <div className="flex justify-between">
                                  <span>Extra Advance Balance</span>
                                  <span>{fmt(settlement.advance_balance)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Total Due */}
                          <div className="bg-red-50/50 dark:bg-red-950/10 rounded-xl p-3 space-y-2 border border-red-100/30">
                            <div className="flex justify-between text-xs font-bold text-red-800 dark:text-red-300">
                              <span>Total Dues & Deductions (B)</span>
                              <span>{fmt(totalDue)}</span>
                            </div>
                            <div className="space-y-1 pl-2 text-[11px] text-red-600 dark:text-red-400">
                              {Number(settlement.pending_rent_dues) > 0 && (
                                <div className="flex justify-between">
                                  <span>Pending Rent</span>
                                  <span>{fmt(settlement.pending_rent_dues)}</span>
                                </div>
                              )}
                              {Number(settlement.pending_late_fees) > 0 && (
                                <div className="flex justify-between">
                                  <span>Late Fees</span>
                                  <span>{fmt(settlement.pending_late_fees)}</span>
                                </div>
                              )}
                              {Number(settlement.pending_utility_dues) > 0 && (
                                <div className="flex justify-between">
                                  <span>Utility & Other Dues</span>
                                  <span>{fmt(settlement.pending_utility_dues)}</span>
                                </div>
                              )}
                              {Number(settlement.total_deductions) > 0 && (
                                <div className="flex justify-between">
                                  <span>Inspection Deductions</span>
                                  <span>{fmt(settlement.total_deductions)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Net Settlement */}
                          <div className="flex justify-between items-center border-t border-border pt-3 px-1">
                            <div className="text-xs font-bold text-foreground">
                              {netDiff >= 0 ? 'Net Refund to Tenant (A - B)' : 'Net Tenant Owed (B - A)'}
                            </div>
                            <div className={`text-sm font-black ${netDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmt(Math.abs(netDiff))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* OPERATIONAL HISTORY TIMELINE */}
                    <div className="rounded-2xl border border-border bg-background p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-accent" />
                        <h3 className="text-sm font-bold text-foreground">Operational History</h3>
                      </div>
                      <div className="space-y-4 relative pl-4 border-l-2 border-secondary/60">
                        {[
                          {
                            label: 'Requested',
                            description: 'Move-out request submitted',
                            date: active.created_at,
                            done: true,
                          },
                          {
                            label: 'Room Inspected',
                            description: active.inspection 
                              ? `Room condition is ${active.inspection.room_condition}. Damages: ${fmt(active.inspection.damages_amount)}`
                              : 'Inspection pending',
                            date: active.inspection?.inspected_at || active.inspection?.created_at,
                            done: !!active.inspection,
                          },
                          {
                            label: 'Settlement Confirmed',
                            description: active.settlement?.settled_at 
                              ? `Settlement confirmed: ${active.settlement.settlement_direction === 'OWNER_OWES_TENANT' ? 'Refund' : 'Owed'} ${fmt(Math.abs(active.settlement.net_settlement_amount))}`
                              : 'Settlement confirmation pending',
                            date: active.settlement?.settled_at,
                            done: !!active.settlement?.settled_at,
                          },
                          {
                            label: 'Bed Vacated',
                            description: active.physical_exit_date 
                              ? `Bed vacated & released on ${fmtDate(active.physical_exit_date)}`
                              : 'Physical exit pending',
                            date: active.physical_exit_date,
                            done: !!active.physical_exit_date,
                          },
                          {
                            label: 'Completed',
                            description: active.completed_at 
                              ? 'Move-out process closed'
                              : 'Final payment processing pending',
                            date: active.completed_at,
                            done: !!active.completed_at,
                          },
                        ].map((step, idx) => (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background ${step.done ? 'bg-accent' : 'bg-muted'} shrink-0`} />
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <span className={`text-xs font-bold ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                                {step.date && (
                                  <span className="text-[10px] text-muted-foreground font-semibold">{fmtDate(step.date)}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {disputes.length > 0 && (
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <h3 className="text-sm font-semibold text-foreground">Tenant concerns</h3>
                        <div className="mt-3 space-y-2">
                          {disputes.map((d) => (
                            <div key={String(d.id)} className="rounded-xl bg-muted/40 p-3 text-sm">
                              <div className="flex justify-between gap-2">
                                <p className="font-medium text-foreground">{String(d.dispute_type).replace(/_/g, ' ')}</p>
                                <span className="text-xs text-muted-foreground">{String(d.status)}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{String(d.description ?? '')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {String(active.status) === 'REQUESTED' && (
                        !showInspectForm ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setShowInspectForm(true)}
                              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground"
                            >
                              Start room inspection
                            </button>
                            <button
                              type="button"
                              disabled={rejectMutation.isPending}
                              onClick={() => {
                                if (window.confirm("Are you sure you want to reject this move-out request?")) {
                                  rejectMutation.mutate();
                                }
                              }}
                              className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {rejectMutation.isPending ? 'Rejecting...' : 'Reject request'}
                            </button>
                          </div>
                        ) : (
                          <InspectionForm
                            roomCondition={roomCondition}
                            setRoomCondition={setRoomCondition}
                            cleaningStatus={cleaningStatus}
                            setCleaningStatus={setCleaningStatus}
                            damagesAmount={damagesAmount}
                            setDamagesAmount={setDamagesAmount}
                            cleaningFee={cleaningFee}
                            setCleaningFee={setCleaningFee}
                            missingItemsFee={missingItemsFee}
                            setMissingItemsFee={setMissingItemsFee}
                            otherDeductions={otherDeductions}
                            setOtherDeductions={setOtherDeductions}
                            deductionNotes={deductionNotes}
                            setDeductionNotes={setDeductionNotes}
                            generalNotes={generalNotes}
                            setGeneralNotes={setGeneralNotes}
                            isPending={inspectMutation.isPending}
                            onCancel={() => setShowInspectForm(false)}
                            onSubmit={(overrides?: any) => {
                              const finalValues = {
                                roomCondition: overrides?.roomCondition ?? roomCondition,
                                cleaningStatus: overrides?.cleaningStatus ?? cleaningStatus,
                                damagesAmount: overrides ? (Number(overrides.damagesAmount) || 0) : (Number(damagesAmount) || 0),
                                cleaningFee: overrides ? (Number(overrides.cleaningFee) || 0) : (Number(cleaningFee) || 0),
                                missingItemsFee: overrides ? (Number(overrides.missingItemsFee) || 0) : (Number(missingItemsFee) || 0),
                                otherDeductions: overrides ? (Number(overrides.otherDeductions) || 0) : (Number(otherDeductions) || 0),
                                deductionNotes: overrides ? (overrides.deductionNotes || null) : (deductionNotes || null),
                                notes: overrides ? (overrides.generalNotes || null) : (generalNotes || null),
                              };
                              inspectMutation.mutate(finalValues);
                            }}
                            checkedRoom={checkedRoom}
                            setCheckedRoom={setCheckedRoom}
                            checkedKeys={checkedKeys}
                            setCheckedKeys={setCheckedKeys}
                            checkedCupboard={checkedCupboard}
                            setCheckedCupboard={setCheckedCupboard}
                            checkedBelongings={checkedBelongings}
                            setCheckedBelongings={setCheckedBelongings}
                            damageItems={damageItems}
                            newDamageName={newDamageName}
                            setNewDamageName={setNewDamageName}
                            newDamageAmount={newDamageAmount}
                            setNewDamageAmount={setNewDamageAmount}
                            onAddDamageItem={handleAddDamageItem}
                            onRemoveDamageItem={handleRemoveDamageItem}
                          />
                        )
                      )}

                      {String(active.status) === 'SETTLEMENT_PENDING' && (
                        <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <BadgeIndianRupee className="h-4 w-4 text-accent" />
                            <h3 className="text-sm font-semibold text-foreground">Confirm final settlement</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Confirm the final amount before this moves to payment or completion.
                          </p>
                          <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                            <label className="text-xs text-muted-foreground">
                              Settlement result
                              <select
                                value={settlementDirection}
                                onChange={(e) => setSettlementDirection(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                              >
                                <option value="OWNER_OWES_TENANT">Refund to tenant</option>
                                <option value="TENANT_OWES_OWNER">Tenant should pay</option>
                                <option value="SETTLED">No payment needed</option>
                              </select>
                            </label>
                            <label className="text-xs text-muted-foreground">
                              Amount
                              <input
                                type="number"
                                min="0"
                                value={settlementAmount}
                                disabled={settlementDirection === 'SETTLED'}
                                onChange={(e) => setSettlementAmount(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground disabled:opacity-60"
                              />
                            </label>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={settleMutation.isPending}
                              onClick={() => settleMutation.mutate()}
                              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                            >
                              {settleMutation.isPending ? 'Confirming settlement...' : 'Confirm settlement amount'}
                            </button>
                            <button
                              type="button"
                              disabled={rejectMutation.isPending}
                              onClick={() => {
                                if (window.confirm("Are you sure you want to reject this request?")) {
                                  rejectMutation.mutate();
                                }
                              }}
                              className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {rejectMutation.isPending ? 'Rejecting...' : 'Reject request'}
                            </button>
                          </div>
                        </div>
                      )}

                      {String(active.status) === 'APPROVED' && (
                        <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-accent" />
                            <h3 className="text-sm font-semibold text-foreground">Release bed & vacate tenant</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Specify the physical exit date. Confirming this action terminates the room allocation, releases the bed, and transitions the tenant to former tenant.
                          </p>
                          <div className="space-y-3">
                            <label className="block text-xs text-muted-foreground">
                              Physical exit date
                              <input
                                type="date"
                                value={physicalExitDate}
                                onChange={(e) => setPhysicalExitDate(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={vacateMutation.isPending || !physicalExitDate}
                              onClick={() => vacateMutation.mutate()}
                              className="w-full rounded-xl bg-[#243A72] py-3 text-sm font-semibold text-white hover:bg-[#1a2d5c] disabled:opacity-50"
                            >
                              {vacateMutation.isPending ? 'Vacating tenant...' : 'Vacate & release bed'}
                            </button>
                          </div>
                        </div>
                      )}

                      {String(active.status) === 'VACATED' && (
                        <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-accent" />
                            <h3 className="text-sm font-semibold text-foreground">Record final payment</h3>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="text-xs text-muted-foreground">
                              Method
                              <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                              >
                                <option value="UPI">UPI</option>
                                <option value="CASH">Cash</option>
                                <option value="BANK_TRANSFER">Bank transfer</option>
                              </select>
                            </label>
                            <label className="text-xs text-muted-foreground">
                              Reference
                              <input
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                                placeholder="Txn/ref no."
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                              />
                            </label>
                          </div>
                          <textarea
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            rows={2}
                            placeholder="Payment notes..."
                            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                          />
                          <button
                            type="button"
                            disabled={completeMutation.isPending}
                            onClick={() => completeMutation.mutate()}
                            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                          >
                            {completeMutation.isPending ? 'Completing move-out...' : 'Confirm payment and complete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STICKY DECISION BAR */}
              {['REQUESTED', 'SETTLEMENT_PENDING', 'APPROVED', 'VACATED'].includes(String(active.status)) && (
                <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border border-border p-4 flex flex-col sm:flex-row gap-3 justify-between items-center mt-6 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-2xl">
                  <div className="text-left hidden sm:block">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Current State</p>
                    <p className="text-sm font-bold text-foreground capitalize">{String(active.status).toLowerCase().replace(/_/g, ' ')}</p>
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    {String(active.status) === 'REQUESTED' && (
                      <>
                        <button
                          type="button"
                          disabled={rejectMutation.isPending}
                          onClick={() => {
                            if (window.confirm("Are you sure you want to reject this request?")) {
                              rejectMutation.mutate();
                            }
                          }}
                          className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors"
                        >
                          Reject Request
                        </button>
                        {!showInspectForm ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowInspectForm(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                          >
                            Start Inspection
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={inspectMutation.isPending}
                            onClick={() => inspectMutation.mutate({
                              roomCondition,
                              cleaningStatus,
                              damagesAmount: Number(damagesAmount) || 0,
                              cleaningFee: Number(cleaningFee) || 0,
                              missingItemsFee: Number(missingItemsFee) || 0,
                              otherDeductions: Number(otherDeductions) || 0,
                              deductionNotes: deductionNotes || null,
                              notes: generalNotes || null,
                            })}
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                          >
                            {inspectMutation.isPending ? 'Saving...' : 'Submit & Request Settlement'}
                          </button>
                        )}
                      </>
                    )}

                    {String(active.status) === 'SETTLEMENT_PENDING' && (
                      <>
                        <button
                          type="button"
                          disabled={rejectMutation.isPending}
                          onClick={() => {
                            if (window.confirm("Are you sure you want to reject this request?")) {
                              rejectMutation.mutate();
                            }
                          }}
                          className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors"
                        >
                          Reject Request
                        </button>
                        <button
                          type="button"
                          disabled={settleMutation.isPending}
                          onClick={() => settleMutation.mutate()}
                          className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                        >
                          {settleMutation.isPending ? 'Approving...' : 'Approve Move Out'}
                        </button>
                      </>
                    )}

                    {String(active.status) === 'APPROVED' && (
                      <button
                        type="button"
                        disabled={vacateMutation.isPending}
                        onClick={() => {
                          if (window.confirm("Release this bed and mark the tenant as physically exited?")) {
                            vacateMutation.mutate();
                          }
                        }}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                      >
                        {vacateMutation.isPending ? 'Vacating...' : 'Vacate Bed & Release'}
                      </button>
                    )}

                    {String(active.status) === 'VACATED' && (
                      <button
                        type="button"
                        disabled={completeMutation.isPending}
                        onClick={() => completeMutation.mutate()}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                      >
                        {completeMutation.isPending ? 'Completing...' : 'Confirm Refund & Complete'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  </TenantsLayout>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{String(value)}</p>
    </div>
  );
}

function MoneyRow({ label, value, negative = false }: { label: string; value: unknown; negative?: boolean }) {
  const amount = Number(value ?? 0);
  if (!amount) return null;
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? 'text-destructive' : 'text-foreground'}>{negative ? '-' : ''}{fmt(amount)}</span>
    </div>
  );
}

function InspectionForm(props: {
  roomCondition: string;
  setRoomCondition: (v: string) => void;
  cleaningStatus: string;
  setCleaningStatus: (v: string) => void;
  damagesAmount: string;
  setDamagesAmount: (v: string) => void;
  cleaningFee: string;
  setCleaningFee: (v: string) => void;
  missingItemsFee: string;
  setMissingItemsFee: (v: string) => void;
  otherDeductions: string;
  setOtherDeductions: (v: string) => void;
  deductionNotes: string;
  setDeductionNotes: (v: string) => void;
  generalNotes: string;
  setGeneralNotes: (v: string) => void;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (overrides?: any) => void;

  // Checklist props
  checkedRoom: boolean;
  setCheckedRoom: (v: boolean) => void;
  checkedKeys: boolean;
  setCheckedKeys: (v: boolean) => void;
  checkedCupboard: boolean;
  setCheckedCupboard: (v: boolean) => void;
  checkedBelongings: boolean;
  setCheckedBelongings: (v: boolean) => void;

  // Damage items props
  damageItems: { id: string; name: string; amount: number }[];
  newDamageName: string;
  setNewDamageName: (v: string) => void;
  newDamageAmount: string;
  setNewDamageAmount: (v: string) => void;
  onAddDamageItem: () => void;
  onRemoveDamageItem: (id: string, amount: number) => void;
}) {
  const [showDeductions, setShowDeductions] = useState(
    Number(props.cleaningFee) > 0 ||
    Number(props.missingItemsFee) > 0 ||
    Number(props.otherDeductions) > 0 ||
    props.damageItems.length > 0 ||
    !!props.deductionNotes
  );

  return (
    <div className="rounded-2xl border border-border bg-background p-5 space-y-5 shadow-sm">
      <div className="flex justify-between items-center border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">Record Room Inspection</h3>
      </div>

      {/* Quick Pass Option */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5 space-y-2">
        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          If everything is clean, keys are back, and there are no dues or damages, complete the inspection in a single tap:
        </p>
        <button
          type="button"
          disabled={props.isPending}
          onClick={() => {
            props.setCheckedRoom(true);
            props.setCheckedKeys(true);
            props.setCheckedCupboard(true);
            props.setCheckedBelongings(true);
            props.setRoomCondition('GOOD');
            props.setCleaningStatus('CLEAN');
            props.onSubmit({
              roomCondition: 'GOOD',
              cleaningStatus: 'CLEAN',
              damagesAmount: 0,
              cleaningFee: 0,
              missingItemsFee: 0,
              otherDeductions: 0,
              deductionNotes: '',
              generalNotes: 'Quick inspection passed. All checklist items cleared. No damages or deductions.',
            });
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          ✨ Quick Pass (No Damages)
        </button>
      </div>

      {/* Checklist section */}
      <div className="bg-secondary/20 rounded-xl p-3.5 space-y-2">
        <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Inspection Checklist</p>
        <div className="grid grid-cols-1 gap-1">
          {[
            { id: 'roomChecked', label: 'Room Checked (Walls, Ceiling, Fan)', value: props.checkedRoom, onChange: props.setCheckedRoom },
            { id: 'keysReturned', label: 'Keys & Access Cards Returned', value: props.checkedKeys, onChange: props.setCheckedKeys },
            { id: 'cupboardEmpty', label: 'Cupboards Empty & Cleaned', value: props.checkedCupboard, onChange: props.setCheckedCupboard },
            { id: 'belongingsRemoved', label: 'All Personal Belongings Removed', value: props.checkedBelongings, onChange: props.setCheckedBelongings },
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-3 cursor-pointer py-2 px-2.5 hover:bg-muted/40 rounded-lg transition-colors select-none">
              <input
                type="checkbox"
                checked={item.value}
                onChange={(e) => item.onChange(e.target.checked)}
                className="rounded border-border bg-card text-accent focus:ring-accent w-4 h-4 transition-all"
              />
              <span className={`text-xs font-semibold transition-colors ${item.value ? 'text-muted-foreground' : 'text-foreground'}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Segmented Controls for Condition & Cleaning */}
      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Room Condition</span>
          <div className="grid grid-cols-3 gap-1 bg-secondary/30 p-1 rounded-xl mt-1">
            {[
              { value: 'GOOD', label: 'Good', activeColor: 'bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300' },
              { value: 'FAIR', label: 'Fair', activeColor: 'bg-amber-600 text-white dark:bg-amber-500/20 dark:text-amber-300' },
              { value: 'POOR', label: 'Poor', activeColor: 'bg-rose-600 text-white dark:bg-rose-500/20 dark:text-rose-300' },
            ].map((opt) => {
              const active = props.roomCondition === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.setRoomCondition(opt.value)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    active ? `${opt.activeColor} shadow-sm scale-[1.02]` : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Cleaning Status</span>
          <div className="grid grid-cols-2 gap-1 bg-secondary/30 p-1 rounded-xl mt-1">
            {[
              { value: 'CLEAN', label: 'Clean', activeColor: 'bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300' },
              { value: 'DIRTY', label: 'Dirty', activeColor: 'bg-rose-600 text-white dark:bg-rose-500/20 dark:text-rose-300' },
            ].map((opt) => {
              const active = props.cleaningStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.setCleaningStatus(opt.value)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    active ? `${opt.activeColor} shadow-sm scale-[1.02]` : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Deductions Toggle Checkbox */}
      <div className="pt-2 border-t border-border">
        <label className="flex items-center gap-2.5 cursor-pointer py-1 select-none">
          <input
            type="checkbox"
            checked={showDeductions}
            onChange={(e) => setShowDeductions(e.target.checked)}
            className="rounded border-border bg-card text-accent focus:ring-accent w-4 h-4 transition-all"
          />
          <span className="text-xs font-bold text-foreground">Record Damages, Fees, or Deductions</span>
        </label>
      </div>

      {/* Conditional Deductions Section */}
      {showDeductions && (
        <div className="space-y-4 pt-1 animation-fade-in">
          {/* Itemized Damage Charges */}
          <div className="border border-border rounded-xl p-3.5 bg-secondary/10 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Itemized Damage Charges</p>
              <span className="text-xs font-bold text-accent">Total: {fmt(Number(props.damagesAmount))}</span>
            </div>

            {props.damageItems.length > 0 && (
              <div className="space-y-1.5">
                {props.damageItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-secondary/40 px-2.5 py-1.5 rounded-lg text-xs">
                    <span className="text-foreground font-semibold">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">{fmt(item.amount)}</span>
                      <button
                        type="button"
                        onClick={() => props.onRemoveDamageItem(item.id, item.amount)}
                        className="text-red-500 hover:text-red-700 transition-colors p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Item (e.g. Broken Fan)"
                value={props.newDamageName}
                onChange={(e) => props.setNewDamageName(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-accent focus:outline-none"
              />
              <input
                type="number"
                placeholder="Amount"
                value={props.newDamageAmount}
                onChange={(e) => props.setNewDamageAmount(e.target.value)}
                className="w-20 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={props.onAddDamageItem}
                className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Add
              </button>
            </div>
          </div>

          {/* Quick Number Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Cleaning fee" value={props.cleaningFee} onChange={props.setCleaningFee} />
            <NumberField label="Missing items" value={props.missingItemsFee} onChange={props.setMissingItemsFee} />
            <NumberField label="Other deductions" value={props.otherDeductions} onChange={props.setOtherDeductions} />
          </div>

          <input
            value={props.deductionNotes}
            onChange={(e) => props.setDeductionNotes(e.target.value)}
            placeholder="Reason for deductions / details..."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs focus:ring-1 focus:ring-accent focus:outline-none"
          />
        </div>
      )}

      {/* General Inspection Notes */}
      <div className="space-y-1">
        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Inspection Notes</span>
        <textarea
          value={props.generalNotes}
          onChange={(e) => props.setGeneralNotes(e.target.value)}
          rows={2}
          placeholder="Write any additional notes here..."
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs focus:ring-1 focus:ring-accent focus:outline-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary/30 active:scale-[0.98] transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={props.isPending}
          onClick={props.onSubmit}
          className="flex-1 rounded-xl bg-accent py-2.5 text-xs font-bold text-accent-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {props.isPending ? 'Saving...' : 'Submit Inspection'}
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[10px] font-semibold text-muted-foreground">
      {label}
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground focus:ring-1 focus:ring-accent focus:outline-none"
      />
    </label>
  );
}
