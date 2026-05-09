import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, MapPin, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { ownerService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';
import { setActiveHostelId } from '../../lib/hostel/activeHostel';

const HOSTEL_TYPES = [
  { value: 'BOYS',    emoji: '🎓', label: 'Boys Hostel' },
  { value: 'GIRLS',   emoji: '🌸', label: 'Girls Hostel' },
  { value: 'MIXED',   emoji: '🏠', label: 'Mixed / PG' },
  { value: 'WORKING', emoji: '👔', label: 'Working PG' },
];

export default function OnboardingHostel() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', city: '', type: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Hostel name is needed';
    if (!form.city.trim()) e.city = 'City is needed to show the right timezone';
    if (!form.type)        e.type = 'Choose your hostel type';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError('');
    try {
      const response = await ownerService.updateHostel({
        name:         form.name.trim(),
        city:         form.city.trim(),
        hostel_type:  form.type,
        phone:        form.phone.trim() || undefined,
      });
      if (response?.hostel?.id) {
        setActiveHostelId({ ...response.owner, role: 'owner', owner_id: response.owner?.id }, response.hostel.id);
      }
      setStoredStep('HOSTEL_CREATED');
      navigate('/onboarding/billing');
    } catch (err) {
      setApiError(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Tell us about your hostel
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Just the basics — you can add more details later.
        </p>
      </div>

      {apiError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
          {apiError}
        </div>
      )}

      {/* Hostel Name */}
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
          Hostel Name *
        </label>
        <div className="relative">
          <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="onboarding-hostel-name"
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Trishul Boys Hostel"
            className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
              errors.name ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
            }`}
          />
        </div>
        {errors.name && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.name}</p>}
      </div>

      {/* City */}
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
          City *
        </label>
        <div className="relative">
          <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="onboarding-hostel-city"
            type="text"
            value={form.city}
            onChange={e => set('city', e.target.value)}
            placeholder="e.g. Hyderabad"
            className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
              errors.city ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
            }`}
          />
        </div>
        {errors.city && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.city}</p>}
      </div>

      {/* Hostel Type */}
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
          What kind of hostel? *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {HOSTEL_TYPES.map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              id={`onboarding-hostel-type-${value.toLowerCase()}`}
              onClick={() => set('type', value)}
              className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                form.type === value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs font-black text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
        {errors.type && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.type}</p>}
      </div>

      {/* Phone — Optional */}
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
          Hostel Phone <span className="text-slate-300 font-normal normal-case">(optional)</span>
        </label>
        <div className="relative">
          <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="onboarding-hostel-phone"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="9876543210"
            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Skip link */}
      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => navigate('/onboarding/billing')}
          className="text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors"
        >
          Skip for now →
        </button>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          id="onboarding-hostel-continue"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/25 transition-all text-base"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
        </motion.button>
      </div>
    </div>
  );
}
