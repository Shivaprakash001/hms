import React from 'react';

const COLORS = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', icon: 'text-rose-500' },
};

export const StatCard = ({
    title,
    value,
    icon: Icon,
    color = 'indigo',
    iconPosition = 'left',
    isCurrency = false,
    subtitle = null
}) => {
    const style = COLORS[color] || COLORS.indigo;

    if (iconPosition === 'right') {
        return (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                    <p className="text-slate-400 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider mb-1 sm:mb-2">{title}</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">{isCurrency ? '₹' : ''}{value}</h3>
                    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
                </div>
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center ${style.bg} ${style.text}`}>
                    <Icon size={18} className="sm:size-[22px]" strokeWidth={2.5} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className="relative z-10">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${style.bg} flex items-center justify-center ${style.text} mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className="sm:size-[24px]" strokeWidth={2.5} />
                </div>
                <h4 className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.12em] mb-1">{title}</h4>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{isCurrency ? '₹' : ''}{value}</div>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
};
