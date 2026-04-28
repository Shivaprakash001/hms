import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, Home, Users, CheckCircle2, Building2 } from 'lucide-react';

const ShiftTenantModal = ({ selectedTenant, selectedRoom, floors, onClose, onShift }) => {
    const [targetRoomNum, setTargetRoomNum] = useState('');
    const [shifting, setShifting] = useState(false);

    // Filter available rooms (must have capacity > occupied)
    const availableRooms = floors.flatMap(floor =>
        floor.rooms.filter(r => (r.tenants?.length || 0) < r.capacity && r.id !== selectedRoom?.id)
    );

    const handleShift = async () => {
        if (!targetRoomNum) return;

        setShifting(true);
        try {
            // Find target room object
            // Note: ManageRooms passes 'floors' where rooms have 'room_no'
            const targetRoomObj = availableRooms.find(r => r.room_no === targetRoomNum);

            if (!targetRoomObj) {
                throw new Error('Selected target room not found');
            }

            // Call parent handler
            await onShift(selectedTenant.id, targetRoomObj.id);

            onClose();
        } catch (err) {
            alert('Error shifting tenant: ' + err.message);
        } finally {
            setShifting(false);
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
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Relocate Resident</h3>
                                <p className="text-slate-400 text-sm font-medium mt-1">Select a new destination within the hostel.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Current Selection Info */}
                        <div className="bg-slate-50 flex items-center justify-between p-4 rounded-2xl mb-8 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">
                                    {(selectedTenant?.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resident</p>
                                    <p className="text-sm font-black text-slate-900">{selectedTenant?.name || 'Unknown'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <Home size={16} />
                                <span className="text-xs font-bold">From Room {selectedRoom?.room_no}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                <Building2 size={12} /> Available Destinations
                            </label>

                            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {availableRooms.map((room) => (
                                    <motion.button
                                        key={room.id}
                                        whileHover={{ x: 4 }}
                                        onClick={() => setTargetRoomNum(room.room_no)}
                                        className={`w-full p-4 rounded-2xl border text-left transition-all ${targetRoomNum === room.room_no
                                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100'
                                            : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${targetRoomNum === room.room_no ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {room.room_no}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">Room {room.room_no}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">Level {room.floor ?? 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <Users size={12} className="text-slate-300" />
                                                    <span className="text-xs font-black text-slate-900">{(room.tenants?.length || 0)}/{room.capacity}</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-tighter mt-0.5">
                                                    {room.capacity - (room.tenants?.length || 0)} Available
                                                </p>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                                {availableRooms.length === 0 && (
                                    <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-xs font-bold uppercase tracking-widest">No vacancy found</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-8">
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black hover:bg-slate-100 hover:text-slate-900 transition-all"
                            >
                                Cancel
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleShift}
                                disabled={!targetRoomNum || shifting}
                                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {shifting ? 'Processing...' : (
                                    <>
                                        <ArrowRightLeft size={20} />
                                        Relocate
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ShiftTenantModal;
