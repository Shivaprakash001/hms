import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DoorOpen, Plus, CheckCircle2, X, ArrowRight, Loader2, IndianRupee } from 'lucide-react';
import { ownerService, roomService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

const CAPACITY_OPTIONS = [1, 2, 3, 4, 6, 8, 10];
const FLOOR_OPTIONS = [
  { label: 'Ground floor', value: 0 },
  { label: '1st floor',   value: 1 },
  { label: '2nd floor',   value: 2 },
  { label: '3rd floor',   value: 3 },
  { label: '4th floor',   value: 4 },
  { label: '5th floor',   value: 5 },
];

const emptyForm = () => ({ number: '', rent: '', capacity: 2, floor: '' });

export default function OnboardingRooms() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [addedRooms, setAddedRooms] = useState([]);
  const [showForm, setShowForm] = useState(true);
  const [hostelId, setHostelId] = useState('');

  useEffect(() => {
    ownerService.getProfile()
      .then((profile) => setHostelId(profile?.hostel?.id || profile?.hostels?.[0]?.id || ''))
      .catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.number.trim())           e.number = 'Room number or name is required';
    if (!form.rent || Number(form.rent) <= 0) e.rent = 'Enter a valid rent amount';
    return e;
  };

  const handleAddRoom = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError('');
    try {
      const payload = {
        room_no:  form.number.trim(),
        capacity: form.capacity,
        // floor must be an integer or omitted — convert string label to index
        ...(form.floor !== '' ? { floor: Number(form.floor) } : {}),
      };
      if (!hostelId) throw new Error('Please complete hostel setup first.');
      const room = await roomService.create(hostelId, payload);
      setAddedRooms(r => [...r, { id: room.id || Date.now(), number: form.number, rent: Number(form.rent) }]);
      setForm(emptyForm());
      setShowForm(false);
      setStoredStep('FIRST_ROOM_ADDED');
    } catch (err) {
      setApiError(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Could not save room. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (addedRooms.length > 0) setStoredStep('FIRST_ROOM_ADDED');
    navigate('/onboarding/tenant');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Add your first room
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Rooms are the backbone of your hostel. Add one to get started.
        </p>
      </div>

      {apiError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
          {apiError}
        </div>
      )}

      {/* Added rooms list */}
      <AnimatePresence>
        {addedRooms.map(room => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl"
          >
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-emerald-900">Room {room.number}</p>
              <p className="text-xs text-emerald-700 font-medium">₹{Number(room.rent).toLocaleString('en-IN')}/month</p>
            </div>
            <DoorOpen size={14} className="text-emerald-400" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add room form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
          >
            {/* Room number */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Room Number / Name *
              </label>
              <div className="relative">
                <DoorOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="onboarding-room-number"
                  type="text"
                  value={form.number}
                  onChange={e => set('number', e.target.value)}
                  placeholder="e.g. 101, A1, Ground-1"
                  className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.number ? 'border-red-400' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.number && <p className="mt-1 text-xs text-red-500 font-medium">{errors.number}</p>}
            </div>

            {/* Monthly rent */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Monthly Rent *
              </label>
              <div className="relative">
                <IndianRupee size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="onboarding-room-rent"
                  type="number"
                  min="0"
                  value={form.rent}
                  onChange={e => set('rent', e.target.value)}
                  placeholder="5000"
                  className={`w-full pl-10 pr-4 py-3.5 rounded-xl border bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.rent ? 'border-red-400' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.rent && <p className="mt-1 text-xs text-red-500 font-medium">{errors.rent}</p>}
            </div>

            {/* Capacity + Floor row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Capacity (beds)
                </label>
                <select
                  id="onboarding-room-capacity"
                  value={form.capacity}
                  onChange={e => set('capacity', Number(e.target.value))}
                  className="w-full py-3.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CAPACITY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c} {c === 1 ? 'bed' : 'beds'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Floor <span className="text-slate-300 font-normal normal-case">(opt)</span>
                </label>
                <select
                  id="onboarding-room-floor"
                  value={form.floor}
                  onChange={e => set('floor', e.target.value)}
                  className="w-full py-3.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select</option>
                  {FLOOR_OPTIONS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add button */}
            <button
              type="button"
              id="onboarding-add-room-btn"
              onClick={handleAddRoom}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black rounded-xl transition-all active:scale-[0.98] text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add Room</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add another */}
      {!showForm && (
        <button
          type="button"
          id="onboarding-add-another-room"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black rounded-2xl transition-all active:scale-[0.98] text-sm"
        >
          <Plus size={16} /> Add Another Room
        </button>
      )}

      {/* Skip */}
      {addedRooms.length === 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleContinue}
            className="text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors"
          >
            Skip for now →
          </button>
          <p className="text-xs text-slate-300 mt-1">You can add rooms anytime from your dashboard</p>
        </div>
      )}

      {/* Sticky CTA — only shows once a room was added */}
      {addedRooms.length > 0 && (
        <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinue}
            id="onboarding-rooms-continue"
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/25 transition-all text-base"
          >
            Continue <ArrowRight size={18} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
