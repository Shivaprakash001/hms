import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Phone, DoorOpen, IndianRupee, ArrowRight, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';
import { tenantService, roomService, ownerService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

export default function OnboardingTenant() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', room_id: '', rent: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [addedTenant, setAddedTenant] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [hostelId, setHostelId] = useState('');

  useEffect(() => {
    ownerService.getProfile().then((profile) => {
      const nextHostelId = profile?.hostel?.id || profile?.hostels?.[0]?.id || '';
      setHostelId(nextHostelId);
      return nextHostelId ? roomService.getAll(nextHostelId, { limit: 50 }) : [];
    }).then(r => {
      const list = Array.isArray(r) ? r : r?.rooms ?? r?.data ?? [];
      setRooms(list);
      if (list.length === 1) {
        setForm(p => ({ ...p, room_id: list[0].id, rent: String(list[0].base_rent ?? '') }));
      }
    }).catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const handleRoomChange = (roomId) => {
    set('room_id', roomId);
    const room = rooms.find(r => String(r.id) === String(roomId));
    const baseRent = Number(room?.base_rent ?? 0);
    if (baseRent > 0) set('rent', String(baseRent));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Tenant name is required';
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone.trim())) e.phone = 'Enter a valid 10-digit phone number';
    if (!form.rent || Number(form.rent) <= 0) e.rent = 'Enter monthly rent';
    return e;
  };

  const handleAdd = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError('');
    try {
      await tenantService.create({
        name:         form.name.trim(),
        phone:        form.phone.trim(),
        room_id:      form.room_id || undefined,
        monthly_rent: Number(form.rent),
      });
      setAddedTenant({ name: form.name, phone: form.phone });
      setStoredStep('FIRST_TENANT_ADDED');
      setShowInvite(true);
    } catch (err) {
      setApiError(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Could not save tenant. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => navigate('/onboarding/payments');

  // WhatsApp invite URL
  const waMessage = addedTenant
    ? encodeURIComponent(`Hi ${addedTenant.name}! Your room has been set up at our hostel. You can now pay rent online and view your dues anytime. Welcome! 🏠`)
    : '';
  const waUrl = addedTenant ? `https://wa.me/91${addedTenant.phone.trim()}?text=${waMessage}` : '#';

  if (showInvite && addedTenant) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6"
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900">{addedTenant.name} added! 🎉</h2>
          <p className="text-slate-500 text-sm mt-1">Tenant profile is set up and ready.</p>
        </motion.div>

        {/* WhatsApp invite card */}
        <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl p-5">
          <p className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
            <MessageCircle size={16} className="text-[#25D366]" /> Send a WhatsApp invite
          </p>
          <p className="text-xs text-slate-500 mb-4 font-medium">
            Let {addedTenant.name} know their room is ready and they can pay online.
          </p>
          <div className="bg-white rounded-xl border border-slate-100 p-3 mb-4 text-xs text-slate-600 font-medium leading-relaxed">
            Hi {addedTenant.name}! Your room has been set up at our hostel. You can now pay rent online and view your dues anytime. Welcome! 🏠
          </div>
          <div className="flex gap-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              id="onboarding-whatsapp-invite"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#22c55e] text-white font-black rounded-xl active:scale-[0.98] transition-all text-sm"
            >
              <MessageCircle size={16} /> Send WhatsApp
            </a>
            <button
              onClick={handleContinue}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl active:scale-[0.98] transition-all text-sm"
            >
              Skip invite
            </button>
          </div>
        </div>

        {/* Continue button */}
        <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
          <button
            onClick={handleContinue}
            id="onboarding-tenant-continue"
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/25 transition-all text-base"
          >
            Continue to Payments <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Add your first tenant
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Quick setup — documents and details can be collected later.
        </p>
      </div>

      {apiError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
          {apiError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
            Tenant Name *
          </label>
          <div className="relative">
            <UserPlus size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="onboarding-tenant-name"
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Rahul Kumar"
              className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
            />
          </div>
          {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
            Phone Number *
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="onboarding-tenant-phone"
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile"
              className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.phone ? 'border-red-400' : 'border-slate-200'}`}
            />
          </div>
          {errors.phone && <p className="mt-1 text-xs text-red-500 font-medium">{errors.phone}</p>}
        </div>

        {/* Room assignment */}
        {rooms.length > 0 && (
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Assign Room
            </label>
            <div className="relative">
              <DoorOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                id="onboarding-tenant-room"
                value={form.room_id}
                onChange={e => handleRoomChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Select a room (optional)</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_no ?? r.room_number ?? r.number} — ₹{Number(r.base_rent || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Monthly rent */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
            Monthly Rent *
          </label>
          <div className="relative">
            <IndianRupee size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="onboarding-tenant-rent"
              type="number"
              min="0"
              value={form.rent}
              onChange={e => set('rent', e.target.value)}
              placeholder="5000"
              className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.rent ? 'border-red-400' : 'border-slate-200'}`}
            />
          </div>
          {errors.rent && <p className="mt-1 text-xs text-red-500 font-medium">{errors.rent}</p>}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 px-4 py-3 bg-indigo-50 rounded-xl">
        <span className="text-indigo-500 shrink-0 mt-0.5">ℹ️</span>
        <p className="text-xs text-indigo-700 font-medium">
          Detailed verification (Aadhaar, documents, college info) can be completed later from the tenant profile.
        </p>
      </div>

      {/* Skip */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleContinue}
          className="text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors"
        >
          Skip for now →
        </button>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleAdd}
          disabled={saving}
          id="onboarding-add-tenant-btn"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/25 transition-all text-base"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} /> Add Tenant</>}
        </motion.button>
      </div>
    </div>
  );
}
