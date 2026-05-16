import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useHostelContext } from '../../../context/HostelContext';
import { useRooms } from '../../../hooks/useRooms';

export const TenantFormModal = ({ onClose, initialData, onSave }) => {
    const { hostelId } = useHostelContext();
    const { data: floorsData, isLoading: loadingRooms } = useRooms(hostelId, { grouped: true });
    const isInvitationEdit = initialData?.status === 'INVITED';
    
    const rooms = useMemo(() => {
        let allRooms = [];
        if (Array.isArray(floorsData)) {
            for (const floor of floorsData) {
                if (Array.isArray(floor.rooms)) {
                    allRooms = allRooms.concat(floor.rooms);
                }
            }
        }
        return allRooms.filter(r => (r.occupied ?? 0) < (r.capacity ?? Infinity));
    }, [floorsData]);

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        roomId: initialData?.roomId || '',
        rent: initialData?.rent || '',
        status: initialData?.status || 'ACTIVE',
        joinDate: initialData?.joinDate || new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);

    const handleRoomChange = (roomId) => {
        const selectedRoom = rooms.find((room) => String(room.id) === String(roomId));
        const baseRent = Number(selectedRoom?.base_rent ?? 0);
        setFormData({
            ...formData,
            roomId,
            ...(!initialData && baseRent > 0 ? { rent: String(baseRent) } : {}),
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        if (!formData.email && !initialData) {
            // Generate email if not provided for new user
            formData.email = `${formData.name.toLowerCase().replace(/\s/g, '')}.${Math.floor(Math.random() * 1000)}@example.com`;
        }
        await onSave(formData);
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10"
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">
                            {isInvitationEdit ? 'Edit Invitation' : initialData ? 'Details Locked' : 'New Tenant'}
                        </h2>
                        {isInvitationEdit && (
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Changes are allowed only before tenant activation.
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Name</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                        </div>

                        {(!initialData || isInvitationEdit) && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Room</label>
                                <select
                                    value={formData.roomId}
                                    onChange={e => handleRoomChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                    required
                                >
                                    <option value="">Select a room</option>
                                    {loadingRooms
                                        ? <option disabled>Loading rooms...</option>
                                        : rooms.map(r => (
                                            <option key={r.id} value={r.id}>
                                                Room {r.number ?? r.room_no} — {r.occupied ?? 0}/{r.capacity} occupied
                                                {Number(r.base_rent || 0) > 0 ? ` — ₹${Number(r.base_rent).toLocaleString('en-IN')}` : ''}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {isInvitationEdit && (
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Rent</label>
                                <input type="number" required value={formData.rent} onChange={e => setFormData({ ...formData, rent: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Join Date</label>
                                <input type="date" required value={formData.joinDate} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                        </div>

                        {initialData && (initialData.status === 'ACTIVE' || initialData.status === 'LEFT') && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="LEFT">LEFT</option>
                                </select>
                            </div>
                        )}
                        {initialData && ['INVITED', 'CANCELLED', 'EXPIRED'].includes(initialData.status) && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-500">
                                    {initialData.status} <span className="text-xs font-normal">(read-only)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                        <button type="submit" disabled={submitting || (initialData && !isInvitationEdit)} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50">
                            {submitting ? 'Saving...' : isInvitationEdit ? 'Save & Resend' : 'Save Details'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
