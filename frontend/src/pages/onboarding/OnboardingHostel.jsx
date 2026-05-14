import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, DoorOpen, ImagePlus, Layers, Loader2, MapPin, Phone, Sparkles, Utensils, Wifi } from 'lucide-react';
import { ownerService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

const HOSTEL_TYPES = [
  { value: 'BOYS',    emoji: '🎓', label: 'Boys Hostel' },
  { value: 'GIRLS',   emoji: '🌸', label: 'Girls Hostel' },
  { value: 'MIXED',   emoji: '🏠', label: 'Mixed / PG' },
  { value: 'WORKING', emoji: '👔', label: 'Working PG' },
];

export default function OnboardingHostel() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    city: '',
    type: '',
    phone: '',
    address: '',
    state: '',
    pincode: '',
    floors: 2,
    rooms: 12,
    amenities: [],
    hasFood: true,
    hasWifi: true,
    logo: null,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [existingHostelId, setExistingHostelId] = useState('');

  useEffect(() => {
    let cancelled = false;
    ownerService.getHostels()
      .then((response) => {
        if (cancelled) return;
        const hostels = response?.hostels || [];
        const firstActive = hostels.find((hostel) => hostel?.is_active !== false) || hostels[0];
        if (firstActive?.id) setExistingHostelId(firstActive.id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Hostel name is needed';
    if (!form.city.trim()) e.city = 'City is needed to show the right timezone';
    if (!form.address.trim()) e.address = 'Address helps tenants identify the property';
    if (!form.type)        e.type = 'Choose your hostel type';
    return e;
  };

  const toggleAmenity = (amenity) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((item) => item !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const getLatestHostelId = async () => {
    const response = await ownerService.getHostels();
    const hostels = response?.hostels || [];
    const active = hostels.find((hostel) => hostel?.is_active !== false) || hostels[0];
    return active?.id || existingHostelId;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError('');
    try {
      const payload = {
        name:         form.name.trim(),
        city:         form.city.trim(),
        state:        form.state.trim() || undefined,
        pincode:      form.pincode.trim() || undefined,
        address:      form.address.trim(),
        phone:        form.phone.trim() || undefined,
      };
      if (existingHostelId) {
        await ownerService.updateHostel(payload, existingHostelId);
      } else {
        await ownerService.createHostel(payload);
      }
      const hostelId = await getLatestHostelId();
      if (hostelId && form.logo) {
        await ownerService.uploadLogo(form.logo, hostelId);
      }
      localStorage.setItem('hms_onboarding_hostel_profile', JSON.stringify({
        hostel_type: form.type,
        planned_floors: form.floors,
        planned_rooms: form.rooms,
        amenities: form.amenities,
        has_food: form.hasFood,
        has_wifi: form.hasWifi,
      }));
      setStoredStep('HOSTEL_CREATED');
      navigate('/onboarding/checklist');
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
          Create the business profile tenants will recognize. You can fine-tune rooms and rent after this.
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

      {/* Address */}
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
          Address *
        </label>
        <div className="relative">
          <MapPin size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <textarea
            id="onboarding-hostel-address"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Building, street, landmark"
            rows={3}
            className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none ${
              errors.address ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
            }`}
          />
        </div>
        {errors.address && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.address}</p>}
      </div>

      {/* City */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
            City *
          </label>
          <input
              id="onboarding-hostel-city"
              type="text"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              placeholder="Hyderabad"
              className={`w-full px-4 py-3.5 rounded-xl border bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                errors.city ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
              }`}
            />
          {errors.city && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">State</label>
          <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="Telangana" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">Pincode</label>
          <input value={form.pincode} onChange={e => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="500001" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
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

      {/* Business shape */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <p className="text-sm font-black text-slate-900">Property shape</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">Floors</label>
            <div className="relative">
              <Layers size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" min="1" max="20" value={form.floors} onChange={e => set('floors', Math.max(1, Number(e.target.value) || 1))} className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">Rooms</label>
            <div className="relative">
              <DoorOpen size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" min="1" max="500" value={form.rooms} onChange={e => set('rooms', Math.max(1, Number(e.target.value) || 1))} className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Amenities */}
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
          Amenities
        </label>
        <div className="grid grid-cols-2 gap-3">
          {['Laundry', 'Parking', 'Power Backup', 'Study Area'].map((amenity) => (
            <button
              key={amenity}
              type="button"
              onClick={() => toggleAmenity(amenity)}
              className={`rounded-2xl border px-3 py-3 text-sm font-black transition-all ${
                form.amenities.includes(amenity)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {amenity}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => set('hasFood', !form.hasFood)} className={`rounded-2xl border p-4 text-left transition-all ${form.hasFood ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}>
          <Utensils size={18} className="mb-2" />
          <p className="text-sm font-black">Food</p>
          <p className="text-xs font-semibold opacity-70">{form.hasFood ? 'Available' : 'Not offered'}</p>
        </button>
        <button type="button" onClick={() => set('hasWifi', !form.hasWifi)} className={`rounded-2xl border p-4 text-left transition-all ${form.hasWifi ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-500'}`}>
          <Wifi size={18} className="mb-2" />
          <p className="text-sm font-black">WiFi</p>
          <p className="text-xs font-semibold opacity-70">{form.hasWifi ? 'Available' : 'Not offered'}</p>
        </button>
      </div>

      {/* Logo */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <ImagePlus size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900">Hostel logo</p>
            <p className="truncate text-xs font-semibold text-slate-500">{form.logo ? form.logo.name : 'PNG, JPG or WEBP. Optional but recommended.'}</p>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => set('logo', e.target.files?.[0] || null)} />
        </label>
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
          onClick={() => navigate('/onboarding/checklist')}
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
          {saving ? <Loader2 size={18} className="animate-spin" /> : <>Create Hostel <ArrowRight size={18} /></>}
        </motion.button>
      </div>
    </div>
  );
}
