import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';

export function MoveOutsView() {
  const { hostelId = '' } = useParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const [showInspectForm, setShowInspectForm] = useState(false);
  const [roomCondition, setRoomCondition] = useState('GOOD');
  const [cleaningStatus, setCleaningStatus] = useState('CLEAN');
  const [damagesAmount, setDamagesAmount] = useState('0');
  const [cleaningFee, setCleaningFee] = useState('0');
  const [deductionNotes, setDeductionNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.moveOut.list(hostelId),
    queryFn: () => moveOutService.listRequests(hostelId),
    enabled: Boolean(hostelId),
  });

  const { data: detail } = useQuery({
    queryKey: queryKeys.moveOut.detail(hostelId, selectedId ?? ''),
    queryFn: () => moveOutService.getRequest(selectedId!),
    enabled: Boolean(selectedId),
  });

  const inspectMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      moveOutService.inspect(selectedId!, payload),
    onSuccess: () => {
      toast.success('Inspection recorded');
      setShowInspectForm(false);
      setRoomCondition('GOOD');
      setCleaningStatus('CLEAN');
      setDamagesAmount('0');
      setCleaningFee('0');
      setDeductionNotes('');
      setGeneralNotes('');
      qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
    },
  });

  const settleMutation = useMutation({
    mutationFn: () => moveOutService.settle(selectedId!),
    onSuccess: () => {
      toast.success('Settlement approved');
      qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => moveOutService.complete(selectedId!),
    onSuccess: () => {
      toast.success('Move-out completed');
      qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
    },
  });

  const list = Array.isArray(data) ? data : (data as Record<string, unknown>)?.requests ?? [];
  const active = detail ?? (list as Record<string, unknown>[]).find((r) => String(r.id) === selectedId);

  return (
    <TenantsLayout title="Move-outs" subtitle="Inspection, settlement, and exit workflow" backTo={`/hostels/${hostelId}/tenants`}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          ) : (list as Record<string, unknown>[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No move-out requests</p>
          ) : (
            (list as Record<string, unknown>[]).map((r) => (
              <button
                key={String(r.id)}
                type="button"
                onClick={() => setSelectedId(String(r.id))}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedId === String(r.id) ? 'border-accent bg-accent/5' : 'border-border bg-card'
                }`}
              >
                <p className="font-medium">{String(r.tenant_name ?? r.tenant?.profile?.name ?? 'Tenant')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <TenantStatusBadge status={String(r.status)} />
                </div>
              </button>
            ))
          )}
        </div>

        <div>
          {active ? (
            <div className="space-y-4">
              <MoveOutStepper request={active as Record<string, unknown>} hostelId={hostelId} />
              <div className="flex flex-col gap-2">
                {String(active.status) === 'REQUESTED' && (
                  !showInspectForm ? (
                    <button
                      type="button"
                      onClick={() => setShowInspectForm(true)}
                      className="py-2.5 rounded-xl bg-secondary font-medium text-sm"
                    >
                      Record inspection
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <h3 className="text-sm font-semibold">Record Room Inspection</h3>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="block">
                          Room Condition
                          <select
                            value={roomCondition}
                            onChange={(e) => setRoomCondition(e.target.value)}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background"
                          >
                            <option value="GOOD">Good</option>
                            <option value="FAIR">Fair</option>
                            <option value="POOR">Poor</option>
                          </select>
                        </label>
                        <label className="block">
                          Cleaning Status
                          <select
                            value={cleaningStatus}
                            onChange={(e) => setCleaningStatus(e.target.value)}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background"
                          >
                            <option value="CLEAN">Clean</option>
                            <option value="DIRTY">Dirty</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="block">
                          Damage Charges (₹)
                          <input
                            type="number"
                            min="0"
                            value={damagesAmount}
                            onChange={(e) => setDamagesAmount(e.target.value)}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background"
                          />
                        </label>
                        <label className="block">
                          Cleaning Fee (₹)
                          <input
                            type="number"
                            min="0"
                            value={cleaningFee}
                            onChange={(e) => setCleaningFee(e.target.value)}
                            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background"
                          />
                        </label>
                      </div>

                      <label className="block text-xs">
                        Deduction Notes
                        <input
                          type="text"
                          placeholder="e.g. Broken chair, dirty walls"
                          value={deductionNotes}
                          onChange={(e) => setDeductionNotes(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background"
                        />
                      </label>

                      <label className="block text-xs">
                        General Inspection Notes
                        <textarea
                          rows={2}
                          value={generalNotes}
                          onChange={(e) => setGeneralNotes(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background"
                        />
                      </label>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowInspectForm(false)}
                          className="flex-1 py-2 rounded-lg border border-border font-medium text-xs text-muted-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={inspectMutation.isPending}
                          onClick={() => inspectMutation.mutate({
                            roomCondition,
                            cleaningStatus,
                            damagesAmount: Number(damagesAmount) || 0,
                            cleaningFee: Number(cleaningFee) || 0,
                            deductionNotes: deductionNotes || null,
                            notes: generalNotes || null,
                          })}
                          className="flex-1 py-2 rounded-lg bg-accent text-accent-foreground font-semibold text-xs disabled:opacity-50"
                        >
                          {inspectMutation.isPending ? 'Saving...' : 'Submit'}
                        </button>
                      </div>
                    </div>
                  )
                )}
                {String(active.status) === 'INSPECTION_DONE' && (
                  <button
                    type="button"
                    onClick={() => settleMutation.mutate()}
                    className="py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                  >
                    Approve settlement
                  </button>
                )}
                {String(active.status) === 'SETTLEMENT_APPROVED' && (
                  <button
                    type="button"
                    onClick={() => completeMutation.mutate()}
                    className="py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                  >
                    Complete move-out
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Select a request</p>
          )}
        </div>
      </div>
    </TenantsLayout>
  );
}
