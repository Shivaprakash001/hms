import React from 'react';

export const StatusBadge = ({ status }) => {
    const cfg = {
        ACTIVE:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Active' },
        INVITED:   { cls: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: 'Invited' },
        MOVE_OUT_REQUESTED: { cls: 'bg-orange-50 text-orange-700 border-orange-100', label: 'Move-Out Req' },
        LEFT:      { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Left' },
        EXPIRED:   { cls: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Expired' },
        CANCELLED: { cls: 'bg-rose-50 text-rose-600 border-rose-100', label: 'Cancelled' },
    };
    const { cls, label } = cfg[status] || cfg.LEFT;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${cls}`}>{label}</span>;
};
