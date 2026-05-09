import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { ownerService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

export default function OnboardingPayments() {
  const navigate = useNavigate();
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    if (!upiId.trim()) return null; // allowed to skip
    if (!upiId.includes('@')) return 'Enter a valid UPI ID (e.g. name@upi)';
    return null;
  };

  const handleSave = async () => {
    const e = validate();
    if (e) { setError(e); return; }

    setSaving(true);
    setApiError('');
    try {
      if (upiId.trim()) {
        await ownerService.updateHostel({ upi_id: upiId.trim() });
      }
      setStoredStep('COLLECTIONS_ENABLED');
      navigate('/onboarding/done');
    } catch (err) {
      setApiError(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setStoredStep('COLLECTIONS_ENABLED');
    navigate('/onboarding/done');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Enable online collections
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Let tenants pay via UPI, card, or net banking. You collect faster — no follow-ups needed.
        </p>
      </div>

      {apiError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
          {apiError}
        </div>
      )}

      {/* UPI card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Wallet size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">UPI Collection ID</p>
            <p className="text-xs text-slate-500 font-medium">Tenants pay directly to your UPI ID</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
            Your UPI ID
          </label>
          <input
            id="onboarding-upi-id"
            type="text"
            value={upiId}
            onChange={e => { setUpiId(e.target.value); setError(''); }}
            placeholder="yourname@upi"
            className={`w-full px-4 py-3.5 rounded-xl border bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${error ? 'border-red-400' : 'border-slate-200'}`}
          />
          {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
        </div>
      </div>

      {/* Trust indicator */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
        <Lock size={14} className="text-slate-400 shrink-0" />
        <p className="text-xs text-slate-500 font-medium">
          Secure. Your UPI ID is only used for tenant payment collections. No hidden fees.
        </p>
      </div>

      {/* Coming soon note */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl">
        <p className="text-xs font-black text-indigo-700 mb-1">🚀 PhonePe Integration (Starter plan)</p>
        <p className="text-xs text-indigo-600 font-medium">
          Upgrade to enable automated payment links, instant settlements, and full reconciliation.
        </p>
      </div>

      {/* Skip link */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors"
        >
          Set up payments later →
        </button>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          id="onboarding-payments-continue"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/25 transition-all text-base"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <>Save & Continue <ArrowRight size={18} /></>}
        </motion.button>
      </div>
    </div>
  );
}
