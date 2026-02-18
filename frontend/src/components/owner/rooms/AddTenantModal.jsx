import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, CreditCard, Calendar, CheckCircle2 } from 'lucide-react';
import { addTenantToRoom } from '../../../utils/storageUtils';

const AddTenantModal = ({ selectedRoom, onClose, onSuccess, isMockMode, API_BASE_URL, floors, setFloors, setSelectedRoom }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        rent: selectedRoom?.tenants?.[0]?.rent || 8000,
        joinDate: new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.rent || !formData.joinDate) {
            alert('Please fill in all required fields.');
            return;
        }

        setSubmitting(true);
        try {
            const newTenant = {
                ...formData,
                email: `${formData.name.toLowerCase().replace(/\s/g, '')}@example.com`,
                password: 'password', // Default
                status: 'Paid'
            };

            addTenantToRoom(selectedRoom.id, newTenant);

            // Wait a bit for effect
            await new Promise(resolve => setTimeout(resolve, 500));

            await onSuccess(); // Trigger parent refresh

            onClose();
        } catch (err) {
            alert('Error adding tenant: ' + err.message);
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
                    className="relative bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
                >
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Register Resident</h3>
                                <p className="text-slate-400 text-sm font-medium mt-1">Assigning to Room #{selectedRoom.number}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    <User size={12} /> Full Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-900"
                                    placeholder="Enter full name"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    <Phone size={12} /> Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-900"
                                    placeholder="+91 00000 00000"
                                />
                            </div>

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
                                    disabled={submitting}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? 'Processing...' : (
                                        <>
                                            <CheckCircle2 size={20} />
                                            Confirm
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
