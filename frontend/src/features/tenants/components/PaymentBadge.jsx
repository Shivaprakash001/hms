import React from 'react';

export const PaymentBadge = ({ status }) => {
    const styles = {
        PAID: 'bg-green-50 text-green-700 border-green-100',
        PARTIAL: 'bg-yellow-50 text-yellow-700 border-yellow-100',
        PENDING: 'bg-red-50 text-red-700 border-red-100',
        WAIVED: 'bg-slate-100 text-slate-700 border-slate-200',
        NOT_GENERATED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        INACTIVE: 'bg-slate-50 text-slate-500 border-slate-100'
    };
    const cls = styles[status] || styles.PENDING;
    const label = status === 'NOT_GENERATED' ? 'NOT GENERATED' : (status || 'PENDING');

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${cls}`}>
            {label}
        </span>
    );
};
