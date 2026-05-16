import React from 'react';

export const StatCard = ({ icon, label, value, color }) => {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    };
    const style = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
            <div className="relative z-10">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${style.bg} flex items-center justify-center ${style.text} mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                    {React.cloneElement(icon, { size: 20, className: "sm:size-[24px]" })}
                </div>
                <h4 className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.12em] mb-1">{label}</h4>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</div>
            </div>
        </div>
    );
};
