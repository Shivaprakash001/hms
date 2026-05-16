import React, { useState } from 'react';
import { X, Building2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const AddFloorModal = ({ onClose, onAdd }) => {
    const [floorNumber, setFloorNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate a small delay for better UX
        setTimeout(() => {
            try {
                onAdd(floorNumber);
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
                className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100 overflow-hidden"
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Building2 size={20} className="text-indigo-600" />
                        Add New Floor
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Floor Number</label>
                        <input
                            type="number"
                            value={floorNumber}
                            onChange={(e) => setFloorNumber(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="e.g. 4"
                            required
                            min="0"
                        />
                        <p className="text-xs text-slate-500">Enter the numeric value for the new floor.</p>
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
                            {loading ? 'Adding...' : <><Plus size={18} /> Add Floor</>}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddFloorModal;
