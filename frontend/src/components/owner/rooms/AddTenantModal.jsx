import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, CreditCard, Calendar, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { profileService } from '../../../api/services';

const AddTenantModal = ({ selectedRoom, onClose, onAdd }) => {
    const [profiles, setProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [formData, setFormData] = useState({
        rent: selectedRoom?.base_rent || selectedRoom?.tenants?.[0]?.rent || '',
        joinDate: new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAvailableProfiles();
    }, []);

    const fetchAvailableProfiles = async () => {
        try {
            setLoadingProfiles(true);
            const data = await profileService.getUnassignedTenants();
            setProfiles(data.profiles || []);
        } catch (err) {
            console.error("Failed to fetch profiles:", err);
        } finally {
            setLoadingProfiles(false);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProfile) {
            alert('Please select a verified resident.');
            return;
        }
        if (!formData.rent || !formData.joinDate) {
            alert('Please fill in all required fields.');
            return;
        }

        setSubmitting(true);
        try {
            const tenantData = {
                profile_id: selectedProfile.id,
                name: selectedProfile.name,
                email: selectedProfile.email,
                phone: selectedProfile.phone,
                rent: formData.rent,
                joinDate: formData.joinDate,
                status: 'Paid' // Default status
            };

            await onAdd(selectedRoom, tenantData);
            onClose();
        } catch (err) {
            alert('Error adding resident: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
                >
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Assign Resident</h3>
                                <p className="text-slate-400 text-sm font-medium mt-1">Room #{selectedRoom.room_no} • {selectedRoom.capacity - (selectedRoom.tenants?.length || 0)} Beds Left</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Profile Selection */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    <User size={12} /> Search Verified Resident
                                </label>

                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-900"
                                    />
                                </div>

                                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {loadingProfiles ? (
                                        <div className="py-8 text-center text-slate-400 text-sm font-bold flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent animate-spin rounded-full"></div>
                                            Loading verified users...
                                        </div>
                                    ) : filteredProfiles.length > 0 ? (
                                        filteredProfiles.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setSelectedProfile(p)}
                                                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${selectedProfile?.id === p.id
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                                                    : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${selectedProfile?.id === p.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-100'}`}>
                                                        {p.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 text-sm">{p.name}</div>
                                                        <div className="text-[10px] font-bold text-slate-400">{p.email}</div>
                                                    </div>
                                                </div>
                                                {selectedProfile?.id === p.id && <CheckCircle2 size={20} className="text-blue-600" />}
                                                {p.phone && <div className="text-[10px] font-black text-slate-400 flex items-center gap-1"><Phone size={10} /> {p.phone}</div>}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            <AlertCircle className="mx-auto mb-2 text-slate-300" size={24} />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No available residents found</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                        <CreditCard size={12} /> Monthly Rent
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={formData.rent}
                                            onChange={(e) => setFormData({ ...formData, rent: parseInt(e.target.value) })}
                                            className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-black text-slate-900"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                        <Calendar size={12} /> Join Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.joinDate}
                                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-900"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black hover:bg-slate-100 hover:text-slate-900 transition-all"
                                >
                                    Cancel
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={submitting || !selectedProfile}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? 'Processing...' : (
                                        <>
                                            <CheckCircle2 size={20} />
                                            Assign
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddTenantModal;
