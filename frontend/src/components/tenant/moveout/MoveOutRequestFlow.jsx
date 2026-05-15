import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Calendar, MessageSquare, AlertTriangle, Check } from 'lucide-react';

const REASONS = [
  { value: 'COURSE_COMPLETED', label: 'Course completed', emoji: '🎓' },
  { value: 'JOB_RELOCATION', label: 'Job relocation', emoji: '💼' },
  { value: 'TOO_EXPENSIVE', label: 'Too expensive', emoji: '💸' },
  { value: 'POOR_MAINTENANCE', label: 'Poor maintenance', emoji: '🔧' },
  { value: 'FOOD_QUALITY', label: 'Food quality', emoji: '🍽️' },
  { value: 'ROOMMATE_ISSUES', label: 'Roommate issues', emoji: '👥' },
  { value: 'BETTER_HOSTEL', label: 'Found better place', emoji: '🏠' },
  { value: 'PERSONAL_REASONS', label: 'Personal reasons', emoji: '🙏' },
  { value: 'SAFETY_CONCERNS', label: 'Safety concerns', emoji: '🛡️' },
  { value: 'RULES_TOO_STRICT', label: 'Rules too strict', emoji: '📏' },
  { value: 'MOVING_CLOSER', label: 'Moving closer', emoji: '📍' },
  { value: 'OTHER', label: 'Other', emoji: '✏️' },
];

const slide = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.25 } };

export default function MoveOutRequestFlow({ actions, onSuccess, onBack }) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [reasonText, setReasonText] = useState('');

  const minDate = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
  const daysUntil = date ? Math.ceil((new Date(date) - new Date()) / 86400000) : 0;
  const noticeLow = daysUntil > 0 && daysUntil < 30;

  const canNext = step === 0 ? !!date : step === 1 ? !!reason : true;

  const handleSubmit = async () => {
    const ok = await actions.submitRequest({ reason, reasonText, plannedExitDate: date });
    if (ok) onSuccess();
  };

  return (
    <div className="px-1">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Request Move-Out</h2>
          <p className="text-xs text-slate-400">Step {step + 1} of 3</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-indigo-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* Alerts */}
      {actions.actionError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{actions.actionError}</div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 0: Date */}
        {step === 0 && (
          <motion.div key="date" {...slide}>
            <div className="mb-3">
              <Calendar className="w-8 h-8 text-indigo-500 mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">When are you planning to leave?</h3>
              <p className="text-sm text-slate-500">Pick your preferred move-out date.</p>
            </div>
            <input
              type="date" min={minDate} value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-200 text-base bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
            />
            {noticeLow && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  This is less than 30 days away. A short notice may affect your deposit refund.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 1: Reason */}
        {step === 1 && (
          <motion.div key="reason" {...slide}>
            <div className="mb-4">
              <MessageSquare className="w-8 h-8 text-indigo-500 mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">Why are you leaving?</h3>
              <p className="text-sm text-slate-500">This helps us improve. Select the main reason.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <button key={r.value} onClick={() => setReason(r.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all active:scale-[0.97] ${
                    reason === r.value
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}>
                  <span>{r.emoji}</span>
                  <span className="font-medium leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <motion.div key="review" {...slide}>
            <div className="mb-4">
              <Check className="w-8 h-8 text-indigo-500 mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">Review your request</h3>
              <p className="text-sm text-slate-500">Make sure everything looks right.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
              <div className="p-4 flex justify-between">
                <span className="text-sm text-slate-500">Move-out date</span>
                <span className="text-sm font-semibold text-slate-800">
                  {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="p-4 flex justify-between">
                <span className="text-sm text-slate-500">Reason</span>
                <span className="text-sm font-semibold text-slate-800">
                  {REASONS.find(r => r.value === reason)?.emoji} {REASONS.find(r => r.value === reason)?.label}
                </span>
              </div>
            </div>
            <textarea
              value={reasonText} onChange={e => setReasonText(e.target.value)}
              placeholder="Anything else you'd like us to know? (optional)"
              rows={3}
              className="w-full mt-4 p-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-none transition-all"
            />
            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              After submitting, the hostel team will schedule a room inspection and calculate your final settlement.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Back
          </button>
        )}
        {step < 2 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all ${
              canNext ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-600/20' : 'bg-slate-300 cursor-not-allowed'
            }`}>
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={actions.submitting}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
            {actions.submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        )}
      </div>
    </div>
  );
}
