import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Home, Loader2, Send, X, CheckCircle2, AlertCircle, Phone, CreditCard, Wallet, Wrench, Calendar, Settings2 } from 'lucide-react';
import api from '../../api/axios';
import { useHostelContext } from '../../context/HostelContext';

const SkeletonField = () => (
    <div className="space-y-2">
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse ml-1" />
        <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
    </div>
);

const TenantInvitationForm = ({ isOpen, onClose, onInviteSuccess }) => {
    const { hostelId } = useHostelContext();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [monthlyRent, setMonthlyRent] = useState('');
    const [roomId, setRoomId] = useState('');
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingDefaults, setLoadingDefaults] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [maintenanceAmount, setMaintenanceAmount] = useState('');
    const [maintenanceType, setMaintenanceType] = useState('MONTHLY');
    const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [defaultsSource, setDefaultsSource] = useState(null);
    const [customizedFields, setCustomizedFields] = useState({});

    const isInitializing = loadingRooms;

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
            setDefaultsSource(null);
            setCustomizedFields({});
            setLoadingRooms(true);
            fetchRooms(hostelId);
        }
    }, [isOpen, hostelId]);

    const fetchRooms = async (activeHostelId) => {
        if (!activeHostelId) {
            setRooms([]);
            setError('Select a hostel before inviting a tenant.');
            setLoadingRooms(false);
            return;
        }

        try {
            const response = await api.get('/rooms', {
                params: { grouped: false, hostelId: activeHostelId },
            });
            const allRooms = response.data || [];
            const availableRooms = allRooms.filter(r => !r.is_full);
            setRooms(availableRooms);

            const hostelIds = [...new Set(availableRooms.map(r => r.hostel_id).filter(Boolean))];
            if (hostelIds.length === 1) {
                try {
                    const defaults = await api.get(`/hostels/${hostelIds[0]}/billing-defaults`);
                    const billingDefaults = defaults.data?.billing_defaults || {};
                    setAdvanceAmount(String(billingDefaults.advance_deposit ?? 0));
                    setMaintenanceAmount(String(billingDefaults.maintenance_type === 'NONE' ? 0 : (billingDefaults.maintenance_charge ?? 0)));
                    setMaintenanceType(billingDefaults.maintenance_type || 'MONTHLY');
                    setDefaultsSource({ billing_defaults: billingDefaults });
                } catch {
                    // Room selection still performs authoritative room->hostel resolution.
                }
            }
        } catch {
            setRooms([]);
        } finally {
            setLoadingRooms(false);
        }
    };

    const handleRoomChange = async (e) => {
        const selectedId = e.target.value;
        setRoomId(selectedId);
        setCustomizedFields({});
        setDefaultsSource(null);

        if (!selectedId) {
            setMonthlyRent('');
            setAdvanceAmount('');
            setMaintenanceAmount('');
            setMaintenanceType('MONTHLY');
            return;
        }

        setLoadingDefaults(true);
        setError('');
        try {
            const res = await api.get(`/rooms/${selectedId}/invite-defaults`);
            const resolved = res.data?.resolved_values || {};
            setMonthlyRent(String(resolved.monthly_rent ?? ''));
            setAdvanceAmount(String(resolved.advance_deposit ?? 0));
            setMaintenanceAmount(String(resolved.maintenance_charge ?? 0));
            setMaintenanceType(resolved.maintenance_type || 'MONTHLY');
            setDefaultsSource(res.data);
        } catch (err) {
            const detail = err.response?.data?.error?.message ?? err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Could not load room billing defaults.');
        } finally {
            setLoadingDefaults(false);
        }
    };

    const updateCustomized = (field, setter) => (e) => {
        setCustomizedFields(prev => ({ ...prev, [field]: true }));
        setter(e.target.value);
    };

    const handleMaintenanceTypeChange = (e) => {
        const nextType = e.target.value;
        setCustomizedFields(prev => ({ ...prev, maintenance_type: true }));
        setMaintenanceType(nextType);
        if (nextType === 'NONE') setMaintenanceAmount('0');
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

    const inputCls = "block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ops-accent/100 focus:border-ops-accent/500 outline-none transition-all font-medium";
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
                                        <p className="text-xs font-mono break-all text-ops-accent bg-white p-2 rounded border border-slate-100">{successData.activation_link}</p>
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
                                <div className="h-12 bg-ops-accent/15 rounded-2xl animate-pulse mt-2" />
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
                                                <User className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
                                            </div>
                                            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="John Doe" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>Phone Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
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
                                            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
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
                                                <CreditCard className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
                                            </div>
                                            <input
                                                type="number"
                                                value={monthlyRent}
                                                onChange={updateCustomized('monthly_rent', setMonthlyRent)}
                                                className={inputCls}
                                                placeholder={roomId ? '8000' : 'Select a room first'}
                                                required
                                                disabled={!roomId || loadingDefaults}
                                            />
                                        </div>
                                        {!roomId && <p className="text-xs text-slate-400 ml-1">Rent fills from the selected room.</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>Assign Room *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Home className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
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

                                {defaultsSource?.room && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                                    >
                                        <CheckCircle2 size={14} />
                                        Auto-filled from room & hostel settings
                                    </motion.div>
                                )}

                                {/* Joining Date */}
                                <div className="space-y-2">
                                    <label className={labelCls}>Joining Date *</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
                                        </div>
                                        <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className={inputCls} required />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Billing starts from this date. Obligations are generated accordingly.</p>
                                </div>

                                {/* Advance Deposit */}
                                <div className="space-y-2">
                                    <label className={labelCls}>
                                        Advance / Security Deposit (₹)
                                        {defaultsSource && (
                                            <span className="ml-1 normal-case font-normal text-indigo-400">
                                                {customizedFields.advance_deposit ? 'customized' : 'from hostel settings'}
                                            </span>
                                        )}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Wallet className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
                                        </div>
                                        <input type="number" min="0" value={advanceAmount} onChange={updateCustomized('advance_deposit', setAdvanceAmount)} className={inputCls} placeholder="0" />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">One-time refundable deposit. Due on joining date.</p>
                                </div>

                                {/* Maintenance Charge + Type */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <label className={labelCls}>
                                            Maintenance (₹)
                                            {defaultsSource && (
                                                <span className="ml-1 normal-case font-normal text-indigo-400">
                                                    {customizedFields.maintenance_charge ? 'customized' : 'from hostel settings'}
                                                </span>
                                            )}
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Wrench className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
                                            </div>
                                            <input type="number" min="0" value={maintenanceAmount} onChange={updateCustomized('maintenance_charge', setMaintenanceAmount)} className={inputCls} placeholder="0" disabled={maintenanceType === 'NONE'} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>Type</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Settings2 className="h-5 w-5 text-slate-400 group-focus-within:text-ops-accent transition-colors" />
                                            </div>
                                            <select value={maintenanceType} onChange={handleMaintenanceTypeChange} className={`${inputCls} appearance-none`}>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="ONE_TIME">One-time</option>
                                                <option value="NONE">None</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 ml-1 -mt-3">
                                    {maintenanceType === 'MONTHLY' && 'Added to every rent cycle alongside rent.'}
                                    {maintenanceType === 'ONE_TIME' && 'Single charge due on joining date.'}
                                    {maintenanceType === 'NONE' && 'No maintenance obligation will be created for this tenant.'}
                                </p>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || loadingDefaults}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl shadow-xl shadow-teal-600/20 text-sm font-bold text-white bg-ops-accent hover:bg-ops-accent/700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 mt-2"
                                >
                                    {isSubmitting || loadingDefaults ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send size={18} />Send Invitation</>}
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
