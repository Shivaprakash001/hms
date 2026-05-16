import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Search, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';

const STATUSES = {
  REQUESTED: { label: 'Requested', cls: 'bg-amber-100 text-amber-700' },
  INSPECTION_PENDING: { label: 'Inspection', cls: 'bg-blue-100 text-blue-700' },
  INSPECTION_DONE: { label: 'Inspected', cls: 'bg-blue-100 text-blue-700' },
  SETTLEMENT_APPROVED: { label: 'Settlement', cls: 'bg-purple-100 text-purple-700' },
  PAYMENT_PENDING: { label: 'Payment', cls: 'bg-amber-100 text-amber-700' },
  DISPUTED: { label: 'Disputed', cls: 'bg-red-100 text-red-600' },
  COMPLETED: { label: 'Done', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};
const REASON_MAP = {
  COURSE_COMPLETED: 'Course done', JOB_RELOCATION: 'Job move', TOO_EXPENSIVE: 'Cost',
  POOR_MAINTENANCE: 'Maintenance', FOOD_QUALITY: 'Food', ROOMMATE_ISSUES: 'Roommate',
  BETTER_HOSTEL: 'Better place', PERSONAL_REASONS: 'Personal', SAFETY_CONCERNS: 'Safety',
  RULES_TOO_STRICT: 'Rules', MOVING_CLOSER: 'Closer', OTHER: 'Other',
};
const TABS = [
  { key: '', label: 'All' },
  { key: 'REQUESTED', label: 'New' },
  { key: 'PAYMENT_PENDING', label: 'Payment' },
  { key: 'DISPUTED', label: 'Disputed' },
  { key: 'COMPLETED', label: 'Done' },
];

export default function MoveOutManagement() {
  const { hostelId } = useParams();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Inspection form state
  const [insp, setInsp] = useState({ roomCondition: 'GOOD', cleaningStatus: 'CLEAN', damagesAmount: 0, cleaningFee: 0, missingItemsFee: 0, otherDeductions: 0, deductionNotes: '' });
  // Payment form state
  const [pay, setPay] = useState({ paymentMethod: 'CASH', paymentReference: '' });

  const fetchList = useCallback(async () => {
    try { setLoading(true);
      const p = { hostelId }; if (tab) p.status = tab;
      const r = await api.get('/move-out/requests', { params: p });
      setRequests(r.data?.requests || r.data?.data?.requests || []); setTotal(r.data?.total || r.data?.data?.total || 0);
    } catch { setMsg({ type: 'error', text: 'Failed to load requests' }); }
    finally { setLoading(false); }
  }, [hostelId, tab]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openDetail = async (id) => {
    setDetailLoading(true); setSelected(id);
    try { const r = await api.get(`/move-out/requests/${id}`); setDetail(r.data?.data || r.data); }
    catch { setMsg({ type: 'error', text: 'Failed to load details' }); }
    finally { setDetailLoading(false); }
  };

  const act = async (fn) => {
    setSubmitting(true); setMsg({ type: '', text: '' });
    try { await fn(); setMsg({ type: 'ok', text: 'Done!' }); openDetail(selected); fetchList(); }
    catch (e) { setMsg({ type: 'error', text: e.response?.data?.error?.message || 'Failed' }); }
    finally { setSubmitting(false); }
  };

  const Badge = ({ status }) => {
    const s = STATUSES[status] || STATUSES.REQUESTED;
    return <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[60vh]">
      {/* Left: List */}
      <div className={`${selected ? 'hidden lg:block lg:w-[380px] lg:shrink-0' : 'w-full'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Move-Outs</h1>
            <p className="text-xs text-slate-500">{total} request{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white animate-pulse">
                <div className="flex justify-between mb-2"><div className="h-4 w-28 bg-slate-200 rounded" /><div className="h-5 w-16 bg-slate-200 rounded-md" /></div>
                <div className="flex gap-3"><div className="h-3 w-16 bg-slate-200 rounded" /><div className="h-3 w-20 bg-slate-200 rounded" /></div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16"><span className="text-3xl block mb-3">📭</span><p className="text-slate-400 text-sm">No move-out requests yet</p></div>
        ) : (
          <div className="space-y-2">
            {requests.map(req => (
              <button key={req.id} onClick={() => openDetail(req.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-sm ${
                  selected === req.id ? 'border-indigo-400 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-slate-800 truncate">{req.tenant?.profiles?.name || 'Unknown'}</span>
                  <Badge status={req.status} />
                </div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>Room {req.tenant?.room_allocations?.[0]?.room?.room_no || '–'}</span>
                  <span>{new Date(req.planned_exit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span>{REASON_MAP[req.reason] || req.reason}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Detail */}
      <AnimatePresence>
        {selected && (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="flex-1 min-w-0">
            {/* Mobile back */}
            <button onClick={() => { setSelected(null); setDetail(null); }}
              className="lg:hidden flex items-center gap-1 text-sm text-slate-500 mb-3 hover:text-slate-700">
              ← Back to list
            </button>

            {detailLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
            ) : detail ? (
              <div className="space-y-4">
                {msg.text && (
                  <div className={`p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-emerald-50 border border-emerald-100 text-emerald-600'}`}>{msg.text}</div>
                )}

                {/* Header */}
                <div className="rounded-xl bg-white border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{detail.tenant?.profiles?.name}</h2>
                      <p className="text-xs text-slate-500">Room {detail.tenant?.room_allocations?.[0]?.room?.room_no || 'N/A'}</p>
                    </div>
                    <Badge status={detail.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-400 text-xs">Exit Date</span><br/><span className="font-medium text-slate-700">{new Date(detail.planned_exit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</span></div>
                    <div><span className="text-slate-400 text-xs">Reason</span><br/><span className="font-medium text-slate-700">{REASON_MAP[detail.reason] || detail.reason}</span></div>
                  </div>
                  {detail.is_eviction && (
                    <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-red-50 text-xs text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Owner-initiated eviction
                    </div>
                  )}
                </div>

                {/* Inspection Form */}
                {['REQUESTED', 'INSPECTION_PENDING'].includes(detail.status) && !detail.inspection && (
                  <div className="rounded-xl bg-white border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Room Inspection</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Condition</label>
                        <select value={insp.roomCondition} onChange={e => setInsp(p => ({...p, roomCondition: e.target.value}))}
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-sm">
                          <option value="GOOD">Good</option><option value="ACCEPTABLE">Acceptable</option><option value="DAMAGED">Damaged</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Cleaning</label>
                        <select value={insp.cleaningStatus} onChange={e => setInsp(p => ({...p, cleaningStatus: e.target.value}))}
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-sm">
                          <option value="CLEAN">Clean</option><option value="NEEDS_CLEANING">Needs cleaning</option><option value="DEEP_CLEANING">Deep clean</option>
                        </select>
                      </div>
                      {[['damagesAmount','Damages ₹'],['cleaningFee','Cleaning ₹'],['missingItemsFee','Missing ₹'],['otherDeductions','Other ₹']].map(([k,l]) => (
                        <div key={k}>
                          <label className="text-xs text-slate-500 mb-1 block">{l}</label>
                          <input type="number" min="0" value={insp[k]} onChange={e => setInsp(p => ({...p, [k]: Number(e.target.value)}))}
                            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm" />
                        </div>
                      ))}
                    </div>
                    <button onClick={() => act(() => api.post(`/move-out/requests/${selected}/inspect`, insp))} disabled={submitting}
                      className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all">
                      {submitting ? 'Saving…' : 'Submit Inspection'}
                    </button>
                  </div>
                )}

                {/* Approve Settlement */}
                {['REQUESTED', 'INSPECTION_PENDING', 'INSPECTION_DONE'].includes(detail.status) && (
                  <button onClick={() => act(() => api.post(`/move-out/requests/${selected}/settle`))} disabled={submitting}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all">
                    ✅ Approve Settlement
                  </button>
                )}

                {/* Settlement Breakdown */}
                {detail.settlement && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Settlement Breakdown</h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between"><span>Security Deposit</span><span className="font-medium">₹{detail.settlement.security_deposit_amount || 0}</span></div>
                      {Number(detail.settlement.advance_balance || 0) > 0 && <div className="flex justify-between"><span>Advance Balance</span><span className="font-medium">₹{detail.settlement.advance_balance}</span></div>}
                      <div className="flex justify-between text-red-600"><span>Pending Rent Dues</span><span className="font-medium">- ₹{detail.settlement.pending_rent_dues || 0}</span></div>
                      {Number(detail.settlement.total_deductions || 0) > 0 && <div className="flex justify-between text-red-600"><span>Deductions</span><span className="font-medium">- ₹{detail.settlement.total_deductions}</span></div>}
                      <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between font-bold text-slate-800">
                        <span>Net Settlement Amount</span>
                        <span className={detail.settlement.settlement_direction === 'OWNER_OWES_TENANT' ? 'text-red-600' : detail.settlement.settlement_direction === 'TENANT_OWES_OWNER' ? 'text-emerald-600' : 'text-slate-500'}>
                          {detail.settlement.settlement_direction === 'OWNER_OWES_TENANT' ? `Refund ₹${Math.abs(detail.settlement.net_settlement_amount)} to Tenant` : 
                           detail.settlement.settlement_direction === 'TENANT_OWES_OWNER' ? `Collect ₹${Math.abs(detail.settlement.net_settlement_amount)} from Tenant` : 
                           'Settled (₹0)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete Payment */}
                {['PAYMENT_PENDING', 'DISPUTED'].includes(detail.status) && (
                  <div className="rounded-xl bg-white border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Complete Move-Out</h3>
                    {detail.status === 'DISPUTED' && (
                      <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
                        ⚠️ Completing will resolve all open disputes.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Method</label>
                        <select value={pay.paymentMethod} onChange={e => setPay(p => ({...p, paymentMethod: e.target.value}))}
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-sm">
                          <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Reference</label>
                        <input value={pay.paymentReference} onChange={e => setPay(p => ({...p, paymentReference: e.target.value}))}
                          placeholder="Txn ID" className="w-full p-2.5 rounded-lg border border-slate-200 text-sm" />
                      </div>
                    </div>
                    <button onClick={() => act(() => api.post(`/move-out/requests/${selected}/complete`, pay))} disabled={submitting}
                      className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all">
                      {submitting ? 'Processing…' : '🏁 Complete Move-Out'}
                    </button>
                  </div>
                )}

                {/* Completed */}
                {detail.status === 'COMPLETED' && (
                  <div className="text-center py-6 text-emerald-600 font-semibold text-sm">
                    ✅ Completed {detail.completed_at ? new Date(detail.completed_at).toLocaleDateString('en-IN') : ''}
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
