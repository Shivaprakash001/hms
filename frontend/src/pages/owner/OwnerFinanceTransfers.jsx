import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Landmark, Hash, Receipt, Copy, CheckCircle2 } from 'lucide-react';
import { ownerFinanceService } from '../../api/services';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAppPreferences } from '../../context/AppPreferencesContext';

export default function OwnerFinanceTransfers() {
  const { preferences } = useAppPreferences();
  const [copiedId, setCopiedId] = React.useState(null);

  const transfersQ = useQuery({
    queryKey: ['owner-finance-transfers', { limit: 100 }],
    queryFn: () => ownerFinanceService.getTransfers({ limit: 100 }),
    staleTime: 60_000,
  });

  const transfers = transfersQ.data?.transfers || transfersQ.data || [];
  const inr = (amount) => formatCurrency(Number(amount || 0), preferences);

  const handleCopyRef = async (transferId, reference) => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedId(transferId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore — clipboard not available
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/dashboard/finance"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-ops-accent"
          >
            <ArrowLeft size={14} />
            Back to Finance
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Transfers</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Every settlement paid to your bank account is listed here. The reference number (UTR / NEFT) is your authoritative proof; copy it for any disputes.
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Transferred At</th>
                <th className="px-5 py-3">Hostel</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transfersQ.isLoading && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">Loading…</td></tr>
              )}
              {!transfersQ.isLoading && transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No transfers yet</p>
                    <p className="mt-1 text-xs text-slate-400">Settlements will appear here once funds are transferred to your bank.</p>
                  </td>
                </tr>
              )}
              {transfers.map((t) => (
                <tr key={t.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-700">
                    {formatDate(t.transferred_at, preferences, '') || new Date(t.transferred_at).toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{t.hostel_id?.slice(0, 8)}…</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      <Landmark size={12} />
                      {t.payout_method || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {t.payout_reference ? (
                      <button
                        onClick={() => handleCopyRef(t.id, t.payout_reference)}
                        className="group inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 font-mono text-xs text-slate-700 transition hover:border-slate-200 hover:bg-slate-50"
                        title="Copy reference"
                      >
                        <Hash size={12} className="text-slate-400" />
                        {t.payout_reference}
                        {copiedId === t.id ? (
                          <CheckCircle2 size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} className="text-slate-400 opacity-0 transition group-hover:opacity-100" />
                        )}
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-700">{inr(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
