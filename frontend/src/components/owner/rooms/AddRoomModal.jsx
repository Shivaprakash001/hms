import React, { useState } from 'react';
import { X, Bed, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const AddRoomModal = ({ floor, onClose, onAdd }) => {
    const [formData, setFormData] = useState({
        number: '',
        capacity: '2',
        type: 'Non-AC',
        rent: '',
        amenities: 'WiFi, Cupboard, Table'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            try {
                // Split amenities string into array
                const amenitiesArray = formData.amenities.split(',').map(a => a.trim()).filter(a => a);
                onAdd({ ...formData, amenities: amenitiesArray });
                onClose();
            } catch (error) {
                alert(error.message);
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 overflow-hidden"
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Bed size={20} className="text-indigo-600" />
                        Add Room to Floor {floor.number}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Room Number</label>
                            <input
                                type="text"
                                value={formData.number}
                                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="e.g. 101"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Rent (₹)</label>
                            <input
                                type="number"
                                value={formData.rent}
                                onChange={(e) => setFormData({ ...formData, rent: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="e.g. 5000"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Capacity</label>
                            <select
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="1">1 Person</option>
                                <option value="2">2 Sharing</option>
                                <option value="3">3 Sharing</option>
                                <option value="4">4 Sharing</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="Non-AC">Non-AC</option>
                                <option value="AC">AC</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Amenities</label>
                        <input
                            type="text"
                            value={formData.amenities}
                            onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="WiFi, Cupboard, etc. (comma separated)"
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? 'Adding...' : <><Plus size={18} /> Add Room</>}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddRoomModal;
