import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Download, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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

export function TenantFinancialsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dues, payments, advance, isLoading } = useTenantDashboard();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);

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

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Financials</h1>

      <TenantPriorityStrip dues={dues} payments={payments} />

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
                      <span className="font-medium text-sm">Monthly stay</span>
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
    </div>
  );
}
