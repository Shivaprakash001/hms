import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Box, Layers, Users, CreditCard, Loader2 } from 'lucide-react';
import { roomService } from '../../../api/services';

const EditRoomModal = ({ room, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        room_no: '',
        floor: '',
        capacity: '',
        base_rent: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (room) {
            setFormData({
                room_no: room.room_no || room.number || '',
                floor: room.floor || 0,
                capacity: room.capacity || 1,
                base_rent: room.base_rent || ''
            });
        }
    }, [room]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await roomService.update(room.id, {
                room_no: formData.room_no,
                floor: parseInt(formData.floor, 10),
                capacity: parseInt(formData.capacity, 10),
                base_rent: formData.base_rent ? parseInt(formData.base_rent, 10) : undefined
            });
            await onSave();
            onClose();
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(detail?.message || detail || err.message || 'Failed to update room');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                >
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Edit Room</h2>
                            <p className="text-sm font-medium text-slate-400">Modify room settings</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Box size={14} /> Room Name / Number *
                            </label>
                            <input
                                type="text"
                                name="room_no"
                                value={formData.room_no}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-slate-900"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Layers size={14} /> Floor *
                            </label>
                            <input
                                type="number"
                                name="floor"
                                value={formData.floor}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-slate-900"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Users size={14} /> Capacity *
                            </label>
                            <input
                                type="number"
                                name="capacity"
                                value={formData.capacity}
                                onChange={handleChange}
                                min="1"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-slate-900"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <CreditCard size={14} /> Default Room Rent (Optional)
                            </label>
                            <input
                                type="number"
                                name="base_rent"
                                value={formData.base_rent}
                                onChange={handleChange}
                                placeholder="eg: 8000"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-slate-900"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EditRoomModal;
