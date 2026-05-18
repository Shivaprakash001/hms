import { useState } from 'react';
import { X } from 'lucide-react';

const TYPES = [
  { value: 'DEDUCTION_AMOUNT', label: 'Charges seem too high' },
  { value: 'WRONG_DAMAGE', label: 'Damage was pre-existing' },
  { value: 'DEPOSIT_MISSING', label: 'Deposit amount is incorrect' },
  { value: 'OTHER', label: 'Something else' },
];

export default function DisputeFlow({ requestId, actions, onClose }) {
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!type || !description.trim()) return;
    const ok = await actions.raiseDispute(requestId, { disputeType: type, description });
    if (ok) onClose();
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Raise a Concern</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-slate-500 mb-4">We take all concerns seriously. Please describe the issue and we'll review it promptly.</p>

      <div className="space-y-2 mb-4">
        {TYPES.map(t => (
          <button key={t.value} onClick={() => setType(t.value)}
            className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
              type === t.value ? 'border-ops-accent/400 bg-ops-accent/10 text-ops-accent' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <textarea value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Please describe your concern in detail…"
        rows={3}
        className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-ops-accent/500/20 focus:border-ops-accent/400 outline-none resize-none transition-all mb-4"
      />

      <button onClick={handleSubmit} disabled={!type || !description.trim() || actions.submitting}
        className="w-full py-3 rounded-xl bg-ops-accent text-white text-sm font-semibold hover:bg-ops-accent/700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        {actions.submitting ? 'Submitting…' : 'Submit Concern'}
      </button>
    </div>
  );
}
