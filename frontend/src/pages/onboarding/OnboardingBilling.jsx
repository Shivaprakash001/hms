import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, ChevronUp, ChevronDown, Zap, Wallet, Wrench } from 'lucide-react';
import { ownerService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

// Day stepper input component (mobile-friendly, no tiny number input)
function DayStepper({ id, value, onChange, label, hint }) {
  const dec = () => onChange(Math.max(1, value - 1));
  const inc = () => onChange(Math.min(28, value + 1));
  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-2 font-medium">{hint}</p>}
      <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={dec}
          className="flex-1 py-4 flex items-center justify-center text-slate-400 hover:text-ops-accent hover:bg-ops-accent/10 transition-colors active:scale-95"
        >
          <ChevronDown size={20} />
        </button>
        <div className="flex-shrink-0 px-6 py-4 text-center border-x border-slate-100">
          <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">of month</p>
        </div>
        <button
          type="button"
          onClick={inc}
          className="flex-1 py-4 flex items-center justify-center text-slate-400 hover:text-ops-accent hover:bg-ops-accent/10 transition-colors active:scale-95"
        >
          <ChevronUp size={20} />
        </button>
      </div>
    </div>
  );
}

// Visual timeline preview
function TimelinePreview({ rentDay, dueDay }) {
  const shifted = dueDay < rentDay;
  const effectiveDue = shifted ? `${dueDay} (next month)` : `${dueDay}`;
  const thisMonth = new Date().toLocaleString('default', { month: 'long' });
  const nextMonth = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleString('default', { month: 'long' });

  const events = [
    { day: `${thisMonth} ${rentDay}`, label: '📋 Rent schedule saved', sub: 'Use this as the monthly billing date for this hostel', color: 'bg-ops-accent/15 text-ops-accent' },
    { day: `${shifted ? nextMonth : thisMonth} ${dueDay}`, label: '📅 Due date', sub: 'Tenants must pay by this day', color: 'bg-violet-100 text-violet-700' },
    { day: 'After due date', label: '🔔 Reminder window', sub: 'Automatic reminders unlock on Starter', color: 'bg-amber-100 text-amber-700' },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-4">
        Billing Timeline Preview
      </p>
      {events.map((e, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-start gap-3"
        >
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full mt-1.5 ${i === 0 ? 'bg-indigo-400' : i === 1 ? 'bg-violet-400' : 'bg-amber-400'}`} />
            {i < 2 && <div className="w-px flex-1 bg-white/10 mt-1 h-6" />}
          </div>
          <div className="flex-1 pb-1">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{e.day}</p>
            <p className="text-sm font-black text-white">{e.label}</p>
            <p className="text-xs text-white/50 font-medium mt-0.5">{e.sub}</p>
          </div>
        </motion.div>
      ))}
      {shifted && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-3 mt-2">
          <p className="text-xs font-bold text-amber-300">
            ℹ️ Since the due date ({dueDay}) falls before rent generates ({rentDay}), the due date is set to the following month. Tenants get a full grace window.
          </p>
        </div>
      )}
    </div>
  );
}

function MoneyInput({ label, value, onChange, icon: Icon, disabled = false, hint }) {
  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-2 font-medium">{hint}</p>}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Icon size={18} className="text-slate-400" />
        </div>
        <input
          type="number"
          min="0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className={`w-full pl-11 pr-4 py-4 rounded-2xl border font-black outline-none transition-all ${
            disabled
              ? 'bg-slate-100 border-slate-200 text-slate-400'
              : 'bg-white border-slate-200 text-slate-900 focus:border-ops-accent/500 focus:ring-2 focus:ring-ops-accent/100'
          }`}
        />
      </div>
    </div>
  );
}

export default function OnboardingBilling() {
  const navigate = useNavigate();
  const [rentDay, setRentDay] = useState(1);
  const [dueDay, setDueDay]   = useState(5);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [advanceDeposit, setAdvanceDeposit] = useState(5000);
  const [maintenanceCharge, setMaintenanceCharge] = useState(1000);
  const [maintenanceType, setMaintenanceType] = useState('MONTHLY');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [hostelId, setHostelId] = useState('');

  // Auto-detect timezone
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {}
    ownerService.getHostels()
      .then((response) => {
        const hostels = response?.hostels || [];
        const selected = hostels.find((hostel) => hostel?.is_active !== false) || hostels[0] || null;
        if (selected?.id) {
          setHostelId(selected.id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setApiError('');
    try {
      if (!hostelId) {
        throw new Error('Please complete hostel setup first.');
      }
      await ownerService.updatePreferences({
        auto_rent_day:    rentDay,
        due_day:          dueDay,
        timezone:         timezone,
        auto_generate_rent: false,
        auto_send_reminders: false,
      }, hostelId);
      await ownerService.updateHostelBillingDefaults(hostelId, {
        advance_deposit: advanceDeposit,
        maintenance_charge: maintenanceType === 'NONE' ? 0 : maintenanceCharge,
        maintenance_type: maintenanceType,
        auto_fill_room_rent: true,
        allow_override: true,
      });
      setStoredStep('BILLING_CONFIGURED');
      navigate('/onboarding/rooms');
    } catch (err) {
      const data = err?.response?.data;
      setApiError(
        data?.error?.message ||
        data?.message ||
        (typeof data?.error === 'string' ? data.error : '') ||
        data?.detail ||
        err?.message ||
        'Could not save. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
            <Zap size={16} className="text-amber-600" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-amber-600">Critical Step</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Set up rent billing
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Save the billing dates and tenant defaults for this hostel. Automation can be enabled after upgrading.
        </p>
      </div>

      {apiError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
          {apiError}
        </div>
      )}

      {/* Rent Generation Day */}
      <DayStepper
        id="onboarding-rent-day"
        value={rentDay}
        onChange={setRentDay}
        label="Rent cycle starts on the ___th of every month"
        hint="This becomes the default monthly billing date"
      />

      {/* Due Day */}
      <DayStepper
        id="onboarding-due-day"
        value={dueDay}
        onChange={setDueDay}
        label="Tenants must pay by the ___th"
        hint="This is used for dues and reminder timing"
      />

      {/* Timeline preview — updates live */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${rentDay}-${dueDay}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <TimelinePreview rentDay={rentDay} dueDay={dueDay} />
        </motion.div>
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div>
          <p className="text-sm font-black text-slate-900">Tenant invite defaults</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            These defaults are automatically applied while inviting new tenants.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoneyInput
            label="Default advance deposit"
            value={advanceDeposit}
            onChange={setAdvanceDeposit}
            icon={Wallet}
            hint="Refundable security deposit"
          />
          <MoneyInput
            label="Maintenance charge"
            value={maintenanceType === 'NONE' ? 0 : maintenanceCharge}
            onChange={setMaintenanceCharge}
            icon={Wrench}
            disabled={maintenanceType === 'NONE'}
            hint="Monthly, one-time, or disabled"
          />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
            Maintenance type
          </label>
          <select
            value={maintenanceType}
            onChange={(e) => setMaintenanceType(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-black outline-none focus:border-ops-accent/500 focus:ring-2 focus:ring-ops-accent/100"
          >
            <option value="MONTHLY">Monthly maintenance</option>
            <option value="ONE_TIME">One-time maintenance</option>
            <option value="NONE">No maintenance charge</option>
          </select>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Live Preview</p>
          <p className="text-sm font-black text-emerald-900 mt-1">
            New tenants joining this hostel will start with: ₹{advanceDeposit.toLocaleString('en-IN')} deposit
            {maintenanceType === 'NONE'
              ? ' + no maintenance charge'
              : ` + ₹${maintenanceCharge.toLocaleString('en-IN')} ${maintenanceType === 'MONTHLY' ? 'monthly' : 'one-time'} maintenance`}
          </p>
        </div>
      </div>

      {/* Automation availability */}
      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200">
        <div>
          <p className="text-sm font-black text-slate-900">🔔 Auto-reminders</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            WhatsApp and in-app reminders unlock on Starter
          </p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-ops-accent bg-ops-accent/10 px-3 py-1.5 rounded-full">
          Starter
        </span>
      </div>

      {/* Timezone (collapsed, auto-detected) */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-xs font-semibold text-slate-500">
          Timezone: <span className="text-slate-900 font-black">{timezone}</span>
        </p>
        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          Auto-detected ✓
        </span>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          id="onboarding-billing-continue"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-ops-accent hover:bg-ops-accent/700 disabled:opacity-60 text-white font-black rounded-2xl shadow-2xl shadow-teal-600/25 transition-all text-base"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <>Save & Continue <ArrowRight size={18} /></>}
        </motion.button>
      </div>
    </div>
  );
}
