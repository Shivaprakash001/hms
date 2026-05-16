import React from 'react';
import { motion } from 'framer-motion';
import { Users, Trash2, Loader2 } from 'lucide-react';

export const RoomCard = ({ room, onClick, onDelete, isDeleting }) => {
    const isFull = room.tenants?.length >= room.capacity;
    const isVacant = (room.tenants?.length || 0) === 0;
    
    const getStatusStyle = () => {
        if (isFull) return { 
            bg: 'bg-rose-50', 
            text: 'text-rose-600', 
            fill: 'bg-rose-500', 
            border: 'hover:border-rose-200', 
            label: 'FULL' 
        };
        if (isVacant) return { 
            bg: 'bg-emerald-50', 
            text: 'text-emerald-600', 
            fill: 'bg-emerald-500', 
            border: 'hover:border-emerald-200', 
            label: 'VACANT' 
        };
        return { 
            bg: 'bg-amber-50', 
            text: 'text-amber-600', 
            fill: 'bg-amber-500', 
            border: 'hover:border-amber-200', 
            label: 'OCCUPIED' 
        };
    };
    
    const status = getStatusStyle();

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={onClick}
            className={`cursor-pointer group relative bg-white rounded-xl border border-slate-100 ${status.border} shadow-sm hover:shadow-xl transition-all p-5`}
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Room</span>
                    <span className="text-3xl font-black text-slate-900 leading-none">{room.room_no}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-lg ${status.bg} ${status.text} text-[10px] font-black uppercase tracking-widest`}>
                        {status.label}
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onDelete?.();
                        }}
                        disabled={isDeleting || !isVacant}
                        title={isVacant ? 'Delete room' : 'Shift or remove residents before deleting'}
                        className={`p-2 rounded-lg transition-all ${
                            isVacant
                                ? 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                                : 'text-slate-200 cursor-not-allowed'
                        }`}
                    >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                    <Users size={16} className="text-slate-300" />
                    <span>{room.tenants?.length || 0} / {room.capacity} Occupants</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                    <div
                        className={`h-full ${status.fill} transition-all duration-700 ease-out`}
                        style={{ width: `${((room.tenants?.length || 0) / room.capacity) * 100}%` }}
                    />
                </div>
            </div>
        </motion.div>
    );
};
