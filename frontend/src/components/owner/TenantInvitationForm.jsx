import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Home, Loader2, Send, X, CheckCircle2, AlertCircle, Phone, CreditCard, Wallet, Wrench, Calendar, Settings2 } from 'lucide-react';
import api from '../../api/axios';

const SkeletonField = () => (
    <div className="space-y-2">
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse ml-1" />
        <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
    </div>
);

const TenantInvitationForm = ({ isOpen, onClose, onInviteSuccess }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [monthlyRent, setMonthlyRent] = useState('');
    const [roomId, setRoomId] = useState('');
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingPrefs, setLoadingPrefs] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [maintenanceAmount, setMaintenanceAmount] = useState('');
    const [maintenanceType, setMaintenanceType] = useState('MONTHLY');
    const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [prefs, setPrefs] = useState(null);

    const isInitializing = loadingRooms || loadingPrefs;

    useEffect(() => {
        if (isOpen) {
            setSuccessData(null);
            setError('');
            setName('');
            setEmail('');
            setPhone('');
            setMonthlyRent('');
            setRoomId('');
            setAdvanceAmount('');
            setMaintenanceAmount('');
            setMaintenanceType('MONTHLY');
            setJoiningDate(new Date().toISOString().split('T')[0]);
            setPrefs(null);
            setLoadingRooms(true);
            setLoadingPrefs(true);
            fetchRooms();
            fetchPreferences();
        }
    }, [isOpen]);

    const fetchPreferences = async () => {
        try {
            const res = await api.get('/owner/me/preferences');
            const p = res.data;
            setPrefs(p);
            setAdvanceAmount(String(p.advance_amount_default ?? 0));
            setMaintenanceAmount(String(p.maintenance_amount_default ?? 0));
            if (p.maintenance_type) setMaintenanceType(p.maintenance_type);
        } catch {
            setPrefs({ advance_enabled: false, maintenance_enabled: false });
        } finally {
            setLoadingPrefs(false);
        }
    };

    const fetchRooms = async () => {
        try {
            const response = await api.get('/rooms?grouped=false');
            const allRooms = response.data || [];
            setRooms(allRooms.filter(r => !r.is_full));
        } catch {
            setRooms([]);
        } finally {
            setLoadingRooms(false);
        }
    };

    const handleRoomChange = (e) => {
        const selectedId = e.target.value;
        setRoomId(selectedId);
        const selectedRoom = rooms.find(r => r.id === selectedId);
        if (selectedRoom?.monthly_rent) setMonthlyRent(selectedRoom.monthly_rent);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const response = await api.post('/tenants/invite', {
                name,
                email,
                phone: phone || '',
                monthly_rent: monthlyRent ? parseFloat(monthlyRent) : null,
                room_id: roomId,
                advance_amount:     advanceAmount     ? parseFloat(advanceAmount)     : 0,
                maintenance_amount: maintenanceAmount ? parseFloat(maintenanceAmount) : 0,
                maintenance_type:   maintenanceType,
                joining_date:       joiningDate,
            });
            setSuccessData(response.data);
            if (onInviteSuccess) onInviteSuccess(response.data);
        } catch (err) {
            const detail = err.response?.data?.error?.message ?? err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Failed to send invitation.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const inputCls = "block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium";
    const labelCls = "text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative"
            >
                {/* Header — always visible */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Invite New Tenant</h2>
                        <p className="text-sm text-slate-500 font-medium">Send an activation link to a tenant</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 max-h-[80vh] overflow-y-auto">
                    <AnimatePresence mode="wait">

                        {/* ── SUCCESS ── */}
                        {successData ? (
                            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Invitation Sent!</h3>
                                <p className="text-slate-500 font-medium mb-6">Invitation processed for <b>{email}</b>.</p>
                                {successData.activation_link ? (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left mb-8">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Activation Link (For Testing)</p>
                                        <p className="text-xs font-mono break-all text-indigo-600 bg-white p-2 rounded border border-slate-100">{successData.activation_link}</p>
                                    </div>
                                ) : (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-left mb-8">
                                        <p className="text-sm font-semibold text-green-700">Invitation email sent successfully.</p>
                                        <p className="text-xs text-green-700/80 mt-1">The tenant will receive an activation link in their inbox.</p>
                                    </div>
                                )}
                                <button onClick={onClose} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                    Done
                                </button>
                            </motion.div>

                        ) : isInitializing ? (
                            /* ── SKELETON — preferences + rooms not ready yet ── */
                            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <SkeletonField />
                                    <SkeletonField />
                                </div>
                                <SkeletonField />
                                <div className="grid grid-cols-2 gap-4">
                                    <SkeletonField />
                                    <SkeletonField />
                                </div>
                                <SkeletonField />
                                <SkeletonField />
                                <div className="h-12 bg-indigo-100 rounded-2xl animate-pulse mt-2" />
                            </motion.div>

                        ) : (
                            /* ── FORM — only rendered after prefs + rooms are ready ── */
                            <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="flex items-start gap-3 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
                                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                        <p>{error}</p>
                                    </div>
                                )}

                                {/* Name + Phone */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelCls}>Full Name *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="John Doe" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>Phone Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="9876543210" />
                                        </div>
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <label className={labelCls}>Email Address *</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        </div>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="john@example.com" required />
                                    </div>
                                </div>

                                {/* Rent + Room */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelCls}>Monthly Rent (₹) *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <CreditCard className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input type="number" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} className={inputCls} placeholder="8000" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>Assign Room *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Home className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <select value={roomId} onChange={handleRoomChange} className={`${inputCls} appearance-none`} required>
                                                <option value="">Select a room</option>
                                                {rooms.map(room => (
                                                    <option key={room.id} value={room.id}>
                                                        Room {room.room_no} ({room.occupied ?? 0}/{room.capacity} occupied)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Joining Date */}
                                <div className="space-y-2">
                                    <label className={labelCls}>Joining Date *</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        </div>
                                        <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className={inputCls} required />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Billing starts from this date. Obligations are generated accordingly.</p>
                                </div>

                                {/* Advance Deposit */}
                                <div className="space-y-2">
                                    <label className={labelCls}>
                                        Advance / Security Deposit (₹)
                                        {prefs && <span className="ml-1 normal-case font-normal text-indigo-400">from settings</span>}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Wallet className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        </div>
                                        <input type="number" min="0" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} className={inputCls} placeholder="0" />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">One-time refundable deposit. Due on joining date.</p>
                                </div>

                                {/* Maintenance Charge + Type */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <label className={labelCls}>
                                            Maintenance (₹)
                                            {prefs && <span className="ml-1 normal-case font-normal text-indigo-400">from settings</span>}
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Wrench className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input type="number" min="0" value={maintenanceAmount} onChange={e => setMaintenanceAmount(e.target.value)} className={inputCls} placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>Type</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Settings2 className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <select value={maintenanceType} onChange={e => setMaintenanceType(e.target.value)} className={`${inputCls} appearance-none`}>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="ONE_TIME">One-time</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 ml-1 -mt-3">
                                    {maintenanceType === 'MONTHLY' ? 'Added to every rent cycle alongside rent.' : 'Single charge due on joining date.'}
                                </p>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl shadow-xl shadow-indigo-600/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 mt-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send size={18} />Send Invitation</>}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default TenantInvitationForm;
