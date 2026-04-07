
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const PaymentStatsCard = ({ title, value, subtext, type = 'neutral', icon: Icon }) => {
    const colors = {
        success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        warning: 'bg-amber-50 text-amber-600 border-amber-100',
        neutral: 'bg-slate-50 text-slate-600 border-slate-100',
        primary: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        danger: 'bg-rose-50 text-rose-600 border-rose-100'
    };

    const styles = colors[type] || colors.neutral;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${styles}`}>
                    <Icon size={20} />
                </div>
            </div>
            {subtext && (
                <div className="mt-4 flex items-center text-xs font-medium">
                    {subtext}
                </div>
            )}
        </motion.div>
    );
};

export default PaymentStatsCard;
