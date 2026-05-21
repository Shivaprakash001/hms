import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeIndianRupee, CalendarDays, CheckCircle2, ClipboardCheck, Loader2, MessageSquare, Phone } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';

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
  const { hostelId = '' } = useParams();
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
    mutationFn: () => moveOutService.settle(effectiveSelectedId!),
    onSuccess: () => {
      toast.success('Settlement approved');
      invalidate();
    },
    onError: () => toast.error('Could not approve settlement'),
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

  return (
    <TenantsLayout title="Move-outs" subtitle="Inspection, settlement, and exit workflow" backTo={`/hostels/${hostelId}/tenants`}>
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
                              : String(active.status) === 'INSPECTION_DONE'
                                ? 'Inspection is complete. Review the settlement and approve it.'
                                : String(active.status) === 'PAYMENT_PENDING'
                                  ? 'Settlement is approved. Record the refund or collection to complete move-out.'
                                  : String(active.status) === 'COMPLETED'
                                    ? 'Move-out is complete and the room release process has finished.'
                                    : 'Continue the next operational step below.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(active.inspection || String(active.status) === 'INSPECTION_DONE' || String(active.status) === 'PAYMENT_PENDING' || String(active.status) === 'COMPLETED') && (
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
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <BadgeIndianRupee className="h-4 w-4 text-accent" />
                          <h3 className="text-sm font-semibold text-foreground">Payment settlement</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <MoneyRow label="Security deposit" value={settlement.security_deposit_amount} />
                          <MoneyRow label="Advance balance" value={settlement.advance_balance} />
                          <MoneyRow label="Pending rent" value={settlement.pending_rent_dues} negative />
                          <MoneyRow label="Late fees" value={settlement.pending_late_fees} negative />
                          <MoneyRow label="Deductions" value={settlement.total_deductions} negative />
                          <div className="flex justify-between border-t border-border pt-3 font-bold">
                            <span>{direction === 'TENANT_OWES_OWNER' ? 'Tenant should pay' : direction === 'OWNER_OWES_TENANT' ? 'Refund to tenant' : 'Net settlement'}</span>
                            <span className={netAmount < 0 ? 'text-destructive' : 'text-accent'}>{fmt(Math.abs(netAmount))}</span>
                          </div>
                        </div>
                      </div>
                    )}

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
                          <button
                            type="button"
                            onClick={() => setShowInspectForm(true)}
                            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground"
                          >
                            Start room inspection
                          </button>
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
                            onSubmit={() => inspectMutation.mutate({
                              roomCondition,
                              cleaningStatus,
                              damagesAmount: Number(damagesAmount) || 0,
                              cleaningFee: Number(cleaningFee) || 0,
                              missingItemsFee: Number(missingItemsFee) || 0,
                              otherDeductions: Number(otherDeductions) || 0,
                              deductionNotes: deductionNotes || null,
                              notes: generalNotes || null,
                            })}
                          />
                        )
                      )}

                      {String(active.status) === 'INSPECTION_DONE' && (
                        <button
                          type="button"
                          disabled={settleMutation.isPending}
                          onClick={() => settleMutation.mutate()}
                          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                        >
                          {settleMutation.isPending ? 'Approving settlement...' : 'Approve settlement'}
                        </button>
                      )}

                      {String(active.status) === 'PAYMENT_PENDING' && (
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
            </div>
          )}
        </section>
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
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Record room inspection</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label>
          Room condition
          <select value={props.roomCondition} onChange={(e) => props.setRoomCondition(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2">
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
          </select>
        </label>
        <label>
          Cleaning status
          <select value={props.cleaningStatus} onChange={(e) => props.setCleaningStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2">
            <option value="CLEAN">Clean</option>
            <option value="DIRTY">Dirty</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <NumberField label="Damage charges" value={props.damagesAmount} onChange={props.setDamagesAmount} />
        <NumberField label="Cleaning fee" value={props.cleaningFee} onChange={props.setCleaningFee} />
        <NumberField label="Missing items" value={props.missingItemsFee} onChange={props.setMissingItemsFee} />
        <NumberField label="Other deductions" value={props.otherDeductions} onChange={props.setOtherDeductions} />
      </div>
      <input value={props.deductionNotes} onChange={(e) => props.setDeductionNotes(e.target.value)} placeholder="Deduction notes" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
      <textarea value={props.generalNotes} onChange={(e) => props.setGeneralNotes(e.target.value)} rows={2} placeholder="General inspection notes" className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm" />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={props.onCancel} className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground">
          Cancel
        </button>
        <button type="button" disabled={props.isPending} onClick={props.onSubmit} className="flex-1 rounded-lg bg-accent py-2 text-xs font-semibold text-accent-foreground disabled:opacity-50">
          {props.isPending ? 'Saving...' : 'Submit inspection'}
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      {label}
      <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2" />
    </label>
  );
}
