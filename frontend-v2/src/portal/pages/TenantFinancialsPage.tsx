import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CreditCard, Download, Loader2, Send, WalletCards } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { tenantPortalApi } from '@features/tenant-portal/api';
import { TenantPriorityStrip } from '@/portal/components/TenantPriorityStrip';
import { TenantPaymentModal } from '@/portal/components/TenantPaymentModal';
import { RentObligationList } from '@features/tenants/components/financial/RentObligationList';
import { buildPayableObligations } from '@/portal/utils/payableObligations';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const timelineTypeLabel = (type?: string) => {
  const value = String(type || '').replace('PROJECTED_', '').replaceAll('_', ' ');
  if (type === 'PAYMENT') return 'Payment';
  return value || 'Installment';
};
const timelineAmount = (item: any) => {
  if (item.type === 'PAYMENT') return Number(item.amount ?? 0);
  return Number(item.remaining ?? item.amount ?? 0);
};

export function TenantFinancialsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dues, payments, advance, isLoading } = useTenantDashboard();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProjectedIds, setSelectedProjectedIds] = useState<string[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAdvancePayModal, setShowAdvancePayModal] = useState(false);
  const [requestedFrequency, setRequestedFrequency] = useState('QUARTERLY');
  const [requestReason, setRequestReason] = useState('');
  const billingContext = useQuery({
    queryKey: ['tenant', 'billing-frequency'],
    queryFn: () => tenantPortalApi.getMyBillingFrequency(),
  });
  const billingTimeline = useQuery({
    queryKey: ['tenant', 'billing-timeline'],
    queryFn: () => tenantPortalApi.getMyBillingTimeline(),
  });
  const frequencyMutation = useMutation({
    mutationFn: () => tenantPortalApi.requestBillingFrequencyChange({
      requested_frequency: requestedFrequency,
      reason: requestReason,
    }),
    onSuccess: () => {
      toast.success('Billing change request sent to owner');
      setRequestReason('');
      queryClient.invalidateQueries({ queryKey: ['tenant', 'billing-frequency'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Could not submit request');
    },
  });

  const payableItems = useMemo(
    () => buildPayableObligations(dues, payments),
    [dues, payments]
  );

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => payableItems.some((p) => p.id === id)));
  }, [payableItems]);

  useEffect(() => {
    if (searchParams.get('pay') === '1' && payableItems.length > 0) {
      setSelectedIds(payableItems.map((p) => p.id));
      setShowPayModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, payableItems, setSearchParams]);

  const selectedItems = useMemo(
    () => payableItems.filter((p) => selectedIds.includes(p.id)),
    [payableItems, selectedIds]
  );
  const selectedTotal = useMemo(
    () => selectedItems.reduce((s, p) => s + p.amount, 0),
    [selectedItems]
  );

  const obligations = (payments?.obligations ?? []) as Record<string, unknown>[];
  const paymentList = (payments?.payments ?? payments?.history ?? []) as Record<string, unknown>[];
  const recentPayments = paymentList.slice(0, 5);
  const currentObligation = obligations.find((o) => String(o.status).toLowerCase() !== 'paid');

  const advanceBalance = Number(advance?.balance ?? 0);
  const entries = (advance?.entries ?? []) as { type?: string; reason?: string; amount?: number }[];
  const depositTotal = entries
    .filter((e) => e.type === 'CREDIT' && ['DEPOSIT', 'TOPUP'].includes(String(e.reason)))
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const debits = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((x) => x !== id)
    );
  };

  const toggleProjectedSelection = (id: string, checked: boolean) => {
    setSelectedProjectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((x) => x !== id)
    );
  };

  const selectedProjectedItems = useMemo(
    () => timelineItems.filter((item: any) => selectedProjectedIds.includes(item.timeline_id)),
    [timelineItems, selectedProjectedIds]
  );

  const selectedProjectedTotal = useMemo(
    () => selectedProjectedItems.reduce((s: number, item: any) => s + timelineAmount(item), 0),
    [selectedProjectedItems]
  );

  const advancePaymentContext = useMemo(() => {
    return selectedProjectedItems.map((item: any) => ({
      id: item.timeline_id,
      amount: timelineAmount(item),
      label: item.label,
      due_date: item.due_date,
      cycle: item.period_start || item.rent_month,
    }));
  }, [selectedProjectedItems]);

  const handlePaymentSuccess = () => {
    setShowPayModal(false);
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: ['tenant'] });
    toast.success('Payment recorded');
  };

  const handleReceipt = async (paymentId: string) => {
    try {
      const blob = await tenantPortalApi.downloadReceipt(paymentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${paymentId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Receipt downloaded');
    } catch {
      toast.error('Could not download receipt');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const totalDue = Number(dues?.total_due ?? payments?.outstanding_balance ?? 0);
  const timelineItems = billingTimeline.data?.items ?? [];
  const allowedFrequencies = (billingContext.data?.allowed_frequencies ?? ['MONTHLY', 'QUARTERLY'])
    .filter((f: string) => f !== billingContext.data?.active_frequency && f !== 'CUSTOM_INSTALLMENTS');
  const pendingFrequencyRequest = (billingContext.data?.requests ?? []).find((r: any) => r.status === 'PENDING');

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Financials</h1>

      <TenantPriorityStrip dues={dues} payments={payments} />

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <WalletCards className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Billing contract</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Active plan: <span className="font-semibold text-foreground">{String(billingContext.data?.active_frequency ?? 'MONTHLY').replaceAll('_', ' ')}</span>
              </p>
            </div>
          </div>
          {pendingFrequencyRequest && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
              OWNER REVIEW
            </span>
          )}
        </div>

        {pendingFrequencyRequest ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            Your request for {String(pendingFrequencyRequest.requested_frequency).replaceAll('_', ' ')} billing is waiting for owner approval.
          </div>
        ) : (
          allowedFrequencies.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3">
              <select
                value={requestedFrequency}
                onChange={(e) => setRequestedFrequency(e.target.value)}
                className="px-3 py-3 rounded-xl border border-border bg-background text-sm"
              >
                {allowedFrequencies.map((frequency: string) => (
                  <option key={frequency} value={frequency}>{frequency.replaceAll('_', ' ')}</option>
                ))}
              </select>
              <input
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Reason, e.g. parent salary cycle"
                className="px-3 py-3 rounded-xl border border-border bg-background text-sm"
              />
              <button
                type="button"
                disabled={frequencyMutation.isPending}
                onClick={() => frequencyMutation.mutate()}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-50"
              >
                {frequencyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Request
              </button>
            </div>
          )
        )}
      </section>

      {timelineItems.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Payment timeline</h2>
          </div>
          <div className="space-y-2">
            {timelineItems.slice(0, 12).map((item: any) => (
              <div
                key={item.timeline_id ?? item.obligation_id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  item.state === 'upcoming'
                    ? 'border-dashed border-accent/30 bg-accent/5'
                    : item.type === 'PAYMENT'
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.state === 'upcoming' && (
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-border text-accent focus:ring-accent cursor-pointer"
                      checked={selectedProjectedIds.includes(item.timeline_id)}
                      onChange={(e) => toggleProjectedSelection(item.timeline_id, e.target.checked)}
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {timelineTypeLabel(item.type)} · {item.type === 'PAYMENT' ? 'Paid' : 'Due'} {fmtDate(item.due_date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{fmt(timelineAmount(item))}</p>
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">{String(item.state).replaceAll('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>

          {selectedProjectedTotal > 0 && (
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border mt-4">
              <div>
                <p className="text-xs text-muted-foreground">Selected advance total</p>
                <p className="text-xl font-bold text-accent">{fmt(selectedProjectedTotal)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancePayModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm hover:bg-accent/90 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Pay Advance {fmt(selectedProjectedTotal)}
              </button>
            </div>
          )}
        </section>
      )}

      {payableItems.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Pay dues</h2>
            <button
              type="button"
              onClick={() => setSelectedIds(payableItems.map((p) => p.id))}
              className="text-xs text-accent font-medium"
            >
              Select all
            </button>
          </div>
          <ul className="space-y-2">
            {payableItems.map((item) => (
              <li key={item.id}>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) => toggleSelection(item.id, e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-sm">{item.label || 'Rent installment'}</span>
                      <span className="font-bold text-sm">{fmt(item.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {fmtDate(item.due_date)}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Selected total</p>
              <p className="text-xl font-bold">{fmt(selectedTotal)}</p>
            </div>
            <button
              type="button"
              disabled={selectedTotal <= 0}
              onClick={() => setShowPayModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              Pay {selectedTotal > 0 ? fmt(selectedTotal) : 'now'}
            </button>
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 text-center text-sm text-emerald-700 font-medium">
          No pending dues — you&apos;re all caught up
        </div>
      )}

      {currentObligation && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Current billing</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base rent</span>
              <span className="font-medium">
                {fmt(Number(currentObligation.rent_amount ?? currentObligation.amount ?? 0))}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-bold">
              <span>Outstanding</span>
              <span>{fmt(totalDue)}</span>
            </div>
          </div>
        </section>
      )}

      {payments?.next_due_date && (
        <section className="rounded-xl border border-dashed border-border p-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Upcoming</p>
          <p className="text-sm mt-1">
            Next due: <strong>{fmtDate(payments.next_due_date)}</strong>
          </p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Security deposit & advance</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total deposited</span>
            <span className="font-medium">{fmt(depositTotal)}</span>
          </div>
          {debits > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adjustments</span>
              <span className="font-medium">{fmt(debits)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-2 border-t border-border">
            <span>Refundable balance</span>
            <span className="text-accent">{fmt(advanceBalance)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Payment history</h2>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border text-center">
            No payments recorded yet
          </p>
        ) : (
          <ul className="space-y-2">
            {recentPayments.map((p) => (
              <li
                key={String(p.id)}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-sm"
              >
                <div>
                  <p className="font-medium">{fmt(Number(p.amount_paid ?? p.amount ?? 0))}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(String(p.payment_date ?? p.created_at ?? ''))} ·{' '}
                    {String(p.payment_method ?? p.method ?? 'Payment')}
                  </p>
                </div>
                {p.id && (
                  <button
                    type="button"
                    onClick={() => handleReceipt(String(p.id))}
                    className="p-2 rounded-lg text-accent hover:bg-accent/10"
                    aria-label="Download receipt"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">All obligations</h2>
        <RentObligationList obligations={obligations as never[]} />
      </section>

      <TenantPaymentModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        amount={selectedTotal}
        obligationIds={selectedIds}
        paymentContext={selectedItems}
        onSuccess={handlePaymentSuccess}
      />

      <TenantPaymentModal
        open={showAdvancePayModal}
        onClose={() => setShowAdvancePayModal(false)}
        amount={selectedProjectedTotal}
        obligationIds={[]}
        paymentType="ADVANCE"
        paymentContext={advancePaymentContext}
        onSuccess={() => {
          setShowAdvancePayModal(false);
          setSelectedProjectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['tenant'] });
          toast.success('Advance payment recorded successfully!');
        }}
      />
    </div>
  );
}
