import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, ChevronDown, Clock, CreditCard, Download, FileText, Loader2, ShieldCheck, Smartphone, WalletCards } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { paymentService, tenantService } from '../../api/services';
import PaymentModal from '../../components/tenant/payment/PaymentModal';
import { formatCurrency, formatDate, formatDateTime, formatMonthYear } from '../../utils/format';
import TenantScoreCard from '../../components/tenant/TenantScoreCard';

const normalizeObligation = (obligation) => {
  const amount = Number(obligation.remaining_due ?? obligation.outstanding ?? obligation.amount ?? 0);
  return {
    ...obligation,
    id: obligation.id || obligation.obligation_id,
    cycle: obligation.rent_month || obligation.due_date,
    monthlyStay: Number(obligation.rent_amount ?? obligation.amount ?? amount),
    maintenance: Number(obligation.maintenance_amount ?? obligation.maintenanceAmount ?? 0),
    credits: Number(obligation.credit_amount ?? obligation.creditAmount ?? 0),
    adjustments: Number(obligation.adjustment_amount ?? obligation.adjustmentAmount ?? 0),
    amount,
    status: String(obligation.status || 'pending').toLowerCase(),
  };
};

function EmptyState({ title, text }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
      <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{text}</p>
    </div>
  );
}

function AmountLine({ label, amount, helper, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <p className={`${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'} text-sm`}>{label}</p>
        {helper ? <p className="mt-0.5 text-xs text-slate-500">{helper}</p> : null}
      </div>
      <p className={`${strong ? 'text-lg font-black text-slate-950' : 'text-sm font-bold text-slate-800'} shrink-0`}>{amount}</p>
    </div>
  );
}

function PayableCard({ item, preferences, selected, onToggle }) {
  return (
    <label className={`block rounded-3xl border p-5 shadow-sm transition ${selected ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" checked={selected} onChange={(event) => onToggle(item.id, event.target.checked)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950">Monthly Stay</h3>
              <p className="text-sm font-semibold text-slate-500">{formatMonthYear(item.cycle, preferences, 'Current cycle')}</p>
            </div>
            <p className="text-lg font-black text-slate-950">{formatCurrency(item.amount, preferences)}</p>
          </div>
          <div className="mt-4 rounded-2xl bg-white px-4 py-2 ring-1 ring-slate-100">
            <AmountLine label="Monthly Stay" helper="Includes late fee adjustment" amount={formatCurrency(item.monthlyStay, preferences)} />
            {item.maintenance > 0 ? <AmountLine label="Maintenance Charges" helper="Operational utilities and services" amount={formatCurrency(item.maintenance, preferences)} /> : null}
            {item.adjustments > 0 ? <AmountLine label="Previous Adjustments" amount={formatCurrency(item.adjustments, preferences)} /> : null}
            {item.credits > 0 ? <AmountLine label="Credits Applied" amount={`-${formatCurrency(item.credits, preferences)}`} /> : null}
          </div>
          <p className="mt-3 text-sm text-slate-500">Due {item.due_date ? formatDate(item.due_date, preferences) : 'this cycle'}. Deposits and refunds are shown separately.</p>
        </div>
      </div>
    </label>
  );
}

function Timeline({ obligations, payments, preferences }) {
  const events = useMemo(() => {
    const obligationEvents = obligations.map((item) => ({
      id: `o-${item.id}`,
      date: item.due_date || item.cycle,
      title: 'Monthly stay generated',
      text: `${formatMonthYear(item.cycle, preferences, 'Cycle')} payable amount created. Late fee, if any, is included inside Monthly Stay.`,
      tone: item.status === 'overdue' ? 'rose' : 'slate',
    }));
    const paymentEvents = payments.map((payment) => ({
      id: `p-${payment.id}`,
      date: payment.payment_date,
      title: 'Payment received',
      text: `${formatCurrency(payment.amount_paid, preferences)} via ${payment.payment_method || 'recorded method'}`,
      tone: 'green',
      payment,
    }));
    return [...obligationEvents, ...paymentEvents]
      .filter((event) => event.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [obligations, payments, preferences]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Financial Activity Timeline</h2>
      <div className="mt-5 space-y-5">
        {events.length === 0 ? <p className="text-sm text-slate-500">Your financial activity will appear here after the first bill or payment.</p> : events.map((event) => (
          <div key={event.id} className="flex gap-3">
            <span className={`mt-1 h-3 w-3 rounded-full ${event.tone === 'green' ? 'bg-emerald-500' : event.tone === 'rose' ? 'bg-rose-500' : 'bg-slate-900'}`} />
            <div>
              <p className="text-sm font-black text-slate-900">{event.title}</p>
              <p className="text-sm text-slate-500">{event.text}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(event.date, preferences, formatDate(event.date, preferences))}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReceiptCard({ txn, preferences, onDownload, loading, downloaded }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{formatCurrency(txn.amount_paid, preferences)}</p>
          <p className="text-sm text-slate-500">{txn.rent_month ? formatMonthYear(txn.rent_month, preferences) : formatDate(txn.payment_date, preferences)}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Paid</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{txn.payment_method || 'Payment'}</span>
        <span className="font-mono">{txn.transaction_id || txn.reference_number || String(txn.id).slice(0, 8)}</span>
      </div>
      <button onClick={() => onDownload(txn)} disabled={loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-60">
        {loading ? <Loader2 className="animate-spin" size={16} /> : downloaded ? <CheckCircle2 className="text-emerald-600" size={16} /> : <Download size={16} />}
        {downloaded ? 'Downloaded' : 'Download Receipt'}
      </button>
    </div>
  );
}

const TenantPayments = () => {
  const { user } = useAuth();
  const { preferences } = useAppPreferences();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadedId, setDownloadedId] = useState(null);
  const [history, setHistory] = useState({ payments: [], obligations: [] });
  const [selectedObligations, setSelectedObligations] = useState([]);
  const [tenantScore, setTenantScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    if (!user?.tenant_id) return;
    setLoading(true);
    setError('');
    try {
      const data = await paymentService.getTenantHistory(user.tenant_id);
      setHistory(data || { payments: [], obligations: [] });
      tenantService.getMyScore().then(setTenantScore).catch(() => setTenantScore(null));
    } catch {
      setError('We could not load your financials right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.tenant_id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const payableItems = useMemo(() => (history.obligations || [])
    .map(normalizeObligation)
    .filter((item) => !['paid', 'waived'].includes(item.status) && item.amount > 0)
    .sort((a, b) => new Date(a.cycle || a.due_date || 0) - new Date(b.cycle || b.due_date || 0)), [history.obligations]);

  useEffect(() => {
    setSelectedObligations((current) => current.filter((id) => payableItems.some((item) => item.id === id)));
  }, [payableItems]);

  const selectedItems = useMemo(() => payableItems.filter((item) => selectedObligations.includes(item.id)), [payableItems, selectedObligations]);
  const selectedTotal = useMemo(() => selectedItems.reduce((sum, item) => sum + item.amount, 0), [selectedItems]);
  const outstanding = Number(history.outstanding_balance || payableItems.reduce((sum, item) => sum + item.amount, 0));
  const nextDueDate = history.next_due_date ? formatDate(history.next_due_date, preferences) : payableItems[0]?.due_date ? formatDate(payableItems[0].due_date, preferences) : 'No dues';

  const toggleSelection = (id, checked) => setSelectedObligations((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    setSelectedObligations([]);
    await loadHistory();
  };

  const handleDownloadReceipt = async (txn) => {
    if (!txn?.id) return;
    try {
      setDownloadingId(txn.id);
      setDownloadedId(null);
      const blob = await paymentService.downloadReceipt(txn.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${String(txn.id).slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setDownloadedId(txn.id);
      setTimeout(() => setDownloadedId((prev) => (prev === txn.id ? null : prev)), 3000);
    } catch {
      alert('Failed to download receipt.');
    } finally {
      setDownloadingId((prev) => (prev === txn.id ? null : prev));
    }
  };

  if (loading) {
    return <div className="space-y-5 animate-fade-in-up"><div className="h-28 animate-pulse rounded-3xl bg-slate-100" /><div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 animate-pulse rounded-3xl bg-slate-100" />)}</div></div>;
  }

  return (
    <div className="space-y-7 animate-fade-in-up">
      <TenantScoreCard scoreData={tenantScore} compact />
      <header>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Your hostel financials</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Financials</h1>
        <p className="mt-1 text-sm text-slate-500">See what you owe, what it covers, and what happens next.</p>
      </header>

      {error ? <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700"><AlertCircle size={18} className="mb-2" />{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-bold text-slate-300">Total Due</p>
          <p className="mt-2 text-4xl font-black tracking-tight">{outstanding > 0 ? formatCurrency(outstanding, preferences) : 'All Clear'}</p>
          <p className="mt-3 text-sm text-slate-300">{outstanding > 0 ? 'This includes pending monthly stay and approved adjustments. Deposits are handled separately.' : 'No pending dues right now.'}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => setSelectedObligations(payableItems.map((item) => item.id))} disabled={payableItems.length === 0} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40">Select Payable Dues</button>
            <button onClick={() => setShowPaymentModal(true)} disabled={selectedTotal <= 0} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white disabled:bg-slate-700 disabled:text-slate-400">Pay Now</button>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500">Next Due Date</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{nextDueDate}</p>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-800"><ShieldCheck size={18} />Refundable deposit records stay separate from payments.</div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <button onClick={() => setExpandedSummary((value) => !value)} className="flex w-full items-center justify-between gap-3 p-5 text-left">
          <div><h2 className="text-lg font-black text-slate-950">You are paying for</h2><p className="text-sm text-slate-500">Monthly Stay is one payable amount and includes late fee adjustment.</p></div>
          <ChevronDown className={`text-slate-400 transition ${expandedSummary ? 'rotate-180' : ''}`} size={20} />
        </button>
        {expandedSummary ? <div className="space-y-3 border-t border-slate-100 p-5">
          {payableItems.length === 0 ? <EmptyState title="No pending dues right now." text="All tenant collections are up to date. Receipts remain available below." /> : payableItems.map((item) => <PayableCard key={item.id} item={item} preferences={preferences} selected={selectedObligations.includes(item.id)} onToggle={toggleSelection} />)}
          {payableItems.length > 0 ? <div className="sticky bottom-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Selected Total</p><p className="text-2xl font-black text-slate-950">{formatCurrency(selectedTotal, preferences)}</p></div><button onClick={() => setShowPaymentModal(true)} disabled={selectedTotal <= 0} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40"><CreditCard className="mr-2 inline" size={16} />Pay Now</button></div></div> : null}
        </div> : null}
      </section>

      <Timeline obligations={payableItems} payments={history.payments || []} preferences={preferences} />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Receipts</h2><p className="text-sm text-slate-500">Download payment confirmations when available.</p></div><FileText className="text-slate-400" size={22} /></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(history.payments || []).length === 0 ? <div className="md:col-span-2"><EmptyState title="No receipts yet." text="Your receipts will appear here after the owner records or confirms a payment." /></div> : (history.payments || []).map((txn) => <ReceiptCard key={txn.id} txn={txn} preferences={preferences} onDownload={handleDownloadReceipt} loading={downloadingId === txn.id} downloaded={downloadedId === txn.id} />)}
        </div>
      </section>

      <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} amount={selectedTotal} obligationId={selectedObligations.length === 1 ? selectedObligations[0] : null} obligationIds={selectedObligations} paymentContext={selectedItems} onSuccess={handlePaymentSuccess} />
    </div>
  );
};

export default TenantPayments;
