import React from 'react';
import { motion } from 'framer-motion';
import { Users, Bed } from 'lucide-react';

const RoomCard = ({ room, onClick }) => {
    const vacantBeds = room.capacity - room.occupied;
    const occupancyPercentage = (room.occupied / room.capacity) * 100;
    const isFull = room.occupied === room.capacity;
    const isEmpty = room.occupied === 0;

    // Status Badge Helpers
    const getStatusStyles = () => {
        if (isFull) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', label: 'Full' };
        if (isEmpty) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', label: 'Vacant' };
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', label: 'Occupied' };
    };

    const status = getStatusStyles();

    // Progress Bar Color
    const getProgressColor = () => {
        if (occupancyPercentage < 50) return 'bg-emerald-500';
        if (occupancyPercentage < 80) return 'bg-orange-500';
        return 'bg-red-500';
    };

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onClick(room)}
            className="group relative bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
        >
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative z-10">
                {/* Header: Room Number + Status Badge */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unit</p>
                        <h3 className="text-2xl font-black text-slate-900 leading-none">{room.number}</h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${status.bg} ${status.text} ${status.border}`}>
                        {status.label}
                    </div>
                </div>

                {/* Occupancy Progress */}
                <div className="mb-6">
                    <div className="flex items-end justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500">Occupancy</span>
                        <div className="text-right">
                            <span className="text-sm font-black text-slate-900">{room.occupied}</span>
                            <span className="text-xs font-medium text-slate-400"> / {room.capacity}</span>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${occupancyPercentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${getProgressColor()}`}
                        />
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Bed size={14} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacity</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 ml-5">{room.capacity} Beds</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users size={14} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vacancy</span>
                        </div>
                        <p className={`text-sm font-bold ml-5 ${vacantBeds > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {vacantBeds} Available
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default RoomCard;
