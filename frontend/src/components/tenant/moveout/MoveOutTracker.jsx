import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import DisputeFlow from './DisputeFlow';

const EVENT_ICONS = {
  REQUEST: '📋', INSPECTION: '🔍', SETTLEMENT: '💰',
  PAYMENT: '💳', DISPUTE: '⚠️', DISPUTE_RESOLVED: '✅', COMPLETED: '🏁',
};

// Human-readable status with reassurance hints
const STATUS_COPY = {
  REQUESTED: {
    label: 'Request Submitted',
    color: 'bg-ops-accent/15 text-ops-accent',
    hint: 'Request was successfully sent to the owner and is waiting for approval.',
    reassurance: 'To get things done faster, contact the hostel owner and make sure your payments are all set.',
  },
  INSPECTION_PENDING: {
    label: 'Inspection Scheduled',
    color: 'bg-blue-100 text-blue-700',
    hint: 'Your room will be inspected soon. Please ensure all personal belongings are accounted for.',
    reassurance: 'This is a standard process. The team will document the room condition fairly.',
  },
  INSPECTION_DONE: {
    label: 'Inspection Complete',
    color: 'bg-blue-100 text-blue-700',
    hint: 'Your room inspection is done. The settlement is being calculated.',
    reassurance: 'You\'ll be able to review the full breakdown before any payment is made.',
  },
  SETTLEMENT_APPROVED: {
    label: 'Settlement Ready',
    color: 'bg-emerald-100 text-emerald-700',
    hint: 'Your final settlement has been calculated. Review the details below.',
    reassurance: 'If anything looks wrong, you can raise a concern and we\'ll review it.',
  },
  PAYMENT_PENDING: {
    label: 'Refund Processing',
    color: 'bg-amber-100 text-amber-700',
    hint: 'Your refund is being processed by the hostel.',
    reassurance: 'Refunds are usually completed within 2–3 business days.',
  },
  DISPUTED: {
    label: 'Under Review',
    color: 'bg-orange-100 text-orange-700',
    hint: 'Your concern is being reviewed by the hostel team.',
    reassurance: 'We take all concerns seriously. You\'ll be notified once it\'s resolved.',
  },
  COMPLETED: {
    label: 'Move-Out Complete',
    color: 'bg-emerald-100 text-emerald-700',
    hint: 'Everything is settled. Your move-out is complete.',
    reassurance: null,
  },
};

// Action-oriented timeline: each event tells the user what happened AND what comes next
const NEXT_ACTION = {
  REQUEST: 'The hostel team will schedule your room inspection.',
  INSPECTION: 'Your settlement will be calculated based on this inspection.',
  SETTLEMENT: 'The hostel will process your refund or collect any dues.',
  PAYMENT: 'Your move-out is almost complete.',
  DISPUTE: 'The hostel team will review and respond.',
  DISPUTE_RESOLVED: 'Payment processing will continue now.',
  COMPLETED: null,
};

export default function MoveOutTracker({ data, actions, refetch }) {
  const [showDispute, setShowDispute] = useState(false);
  const [expandTimeline, setExpandTimeline] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const status = STATUS_COPY[data.status] || STATUS_COPY.REQUESTED;
  const steps = data.steps || [];
  const events = data.events || [];
  const settlement = data.settlement;
  const isCompleted = data.status === 'COMPLETED';
  const canCancel = ['REQUESTED', 'INSPECTION_PENDING', 'INSPECTION_DONE'].includes(data.status);
  const canDispute = ['PAYMENT_PENDING', 'SETTLEMENT_APPROVED', 'INSPECTION_DONE'].includes(data.status);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your move-out request?')) return;
    const ok = await actions.cancelRequest(data.request_id);
    if (ok) refetch();
  };

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {actions.actionError && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{actions.actionError}</div>}
      {actions.actionSuccess && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm">{actions.actionSuccess}</div>}

      {/* ── Status Banner + Step Progress ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 pb-3">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${status.color}`}>{status.label}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{status.hint}</p>
          {/* Reassurance line */}
          {status.reassurance && (
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">💡 {status.reassurance}</p>
          )}
        </div>
        {/* Step progress bar */}
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-slate-200" />
            {steps.map((s, i) => {
              const filled = s.completed ? 'bg-ops-accent text-white' : s.active ? 'bg-white border-2 border-ops-accent/500 text-ops-accent' : 'bg-slate-100 text-slate-400';
              return (
                <div key={i} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${filled} ${s.active ? 'ring-4 ring-indigo-500/10' : ''}`}>
                    {s.completed ? '✓' : s.icon}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${s.completed || s.active ? 'text-ops-accent' : 'text-slate-400'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Settlement Card — Neutral money tone ── */}
      {settlement && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5">
            <p className="text-xs text-slate-500 mb-1.5 font-medium">
              {settlement.direction === 'OWNER_OWES_TENANT' ? 'Refund amount' :
               settlement.direction === 'TENANT_OWES_OWNER' ? 'Pending balance before completion' : 'Settlement'}
            </p>
            <div className="flex items-end justify-between">
              <p className={`text-3xl font-extrabold tracking-tight ${
                settlement.direction === 'OWNER_OWES_TENANT' ? 'text-emerald-600' : 'text-slate-800'
              }`}>
                ₹{Math.abs(settlement.net_amount).toLocaleString('en-IN')}
              </p>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                settlement.payment_status === 'SETTLED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {settlement.payment_status === 'SETTLED' ? '✅ Confirmed' : '⏳ Pending'}
              </span>
            </div>
            {/* Neutral explanation for tenant-owes */}
            {settlement.direction === 'TENANT_OWES_OWNER' && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This amount covers pending rent or deductions. It will be settled during the exit process.
              </p>
            )}
            {settlement.direction === 'OWNER_OWES_TENANT' && settlement.payment_status !== 'SETTLED' && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This will be refunded to you once the owner confirms the payment.
              </p>
            )}
          </div>
          {canDispute && !showDispute && (
            <div className="px-5 pb-4 border-t border-slate-100 pt-3">
              <button onClick={() => setShowDispute(true)}
                className="text-xs text-slate-500 hover:text-ops-accent transition-colors">
                Something doesn't look right? <span className="underline underline-offset-2">Raise a concern</span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Active & Past Tenant Concerns ── */}
      {data.disputes && data.disputes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            💬 Your Raised Concerns ({data.disputes.filter(d => d.status === 'OPEN').length} Open)
          </h3>
          <div className="space-y-3">
            {data.disputes.map(dispute => {
              const isOpen = dispute.status === 'OPEN';
              return (
                <div key={dispute.id} className={`p-3.5 rounded-xl border text-xs space-y-2 ${isOpen ? 'bg-amber-50/40 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">{dispute.dispute_type?.replace('_', ' ') || 'CONCERN'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isOpen ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                      {isOpen ? 'Under Review' : 'Resolved'}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{dispute.description}</p>
                  
                  {dispute.resolution_notes && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-white border border-slate-100 text-slate-500 text-2xs leading-relaxed">
                      <strong className="text-slate-700 block mb-0.5">Hostel Resolution:</strong>
                      {dispute.resolution_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Dispute Flow ── */}
      {showDispute && (
        <DisputeFlow requestId={data.request_id} actions={actions} onClose={() => { setShowDispute(false); refetch(); }} />
      )}

      {/* ── Event Timeline — Action-oriented ── */}
      {events.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setExpandTimeline(!expandTimeline)} className="w-full flex items-center justify-between p-5 text-left">
            <h3 className="text-sm font-semibold text-slate-700">Activity Timeline</h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{events.length} event{events.length !== 1 ? 's' : ''}</span>
              {expandTimeline ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>
          {expandTimeline && (
            <div className="px-5 pb-5">
              <div className="relative pl-6 border-l-2 border-slate-100 space-y-5">
                {events.map((ev, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      ev.type === 'COMPLETED' ? 'bg-emerald-500' : ev.type === 'DISPUTE' ? 'bg-amber-400' : 'bg-ops-accent'
                    }`} />
                    <p className="text-sm font-medium text-slate-700">{EVENT_ICONS[ev.type] || '📌'} {ev.title}</p>
                    {ev.detail && <p className="text-xs text-slate-500 mt-0.5">{ev.detail}</p>}
                    {/* Action-oriented: what happens next */}
                    {NEXT_ACTION[ev.type] && i === events.length - 1 && (
                      <p className="text-xs text-ops-accent mt-1 font-medium">→ {NEXT_ACTION[ev.type]}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(ev.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Cancel button ── */}
      {canCancel && (
        <button onClick={handleCancel} disabled={actions.submitting}
          className="w-full py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50">
          Cancel Move-Out Request
        </button>
      )}

      {/* ── Completion → then Feedback (sequenced, not simultaneous) ── */}
      {isCompleted && !showFeedback && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 px-4">
          <span className="text-4xl mb-3 block">🙏</span>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Thank you for staying with us</h3>
          <p className="text-sm text-slate-500 mb-6">We wish you all the best ahead.</p>
          <button onClick={() => setShowFeedback(true)}
            className="text-sm text-ops-accent font-medium hover:underline">
            Before you go, share your feedback →
          </button>
        </motion.div>
      )}

      {isCompleted && showFeedback && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FeedbackForm requestId={data.request_id} actions={actions} refetch={refetch} />
        </motion.div>
      )}
    </div>
  );
}
