import React from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Save, RefreshCw, XCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { PaymentBadge } from './PaymentBadge';
import { getInitials } from '../utils/tenantHelpers';

export const TenantList = ({
    tenants,
    loading,
    formatCurrency,
    formatDate,
    onRowClick,
    onEditInvitation,
    onResendInvitation,
    onCancelInvitation,
    onToggleStatus,
    onCallTenant
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="overflow-x-auto">
                <table className="w-full hidden md:table">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            {['NAME', 'ROOM', 'ROLL NO', 'YEAR', 'RENT', 'LAST PAID', 'PENDING', 'PAYMENT STATUS', 'STATUS'].map((header) => (
                                <th key={header} className="px-8 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    {header}
                                </th>
                            ))}
                            <th className="px-8 py-5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                ACTIONS
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr>
                                <td colSpan="10" className="px-8 py-12 text-center text-slate-400 font-medium animate-pulse">
                                    Loading tenants...
                                </td>
                            </tr>
                        ) : tenants.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="px-8 py-16 text-center text-slate-400">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <User size={24} className="text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-1">No tenants found</h3>
                                    <p className="text-sm font-medium">Try adjusting your search or add a new tenant</p>
                                </td>
                            </tr>
                        ) : (
                            tenants.map((tenant) => (
                                <motion.tr
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key={tenant.id}
                                    onClick={() => onRowClick(tenant)}
                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                >
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                {getInitials(tenant.name)}
                                            </div>
                                            <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{tenant.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-slate-600 font-bold text-sm">{tenant.room}</td>
                                    <td className="px-8 py-5 text-slate-600 font-semibold text-sm">{tenant.rollNumber || '-'}</td>
                                    <td className="px-8 py-5 text-slate-600 font-semibold text-sm">{tenant.yearOfStudy ? `${tenant.yearOfStudy} Year` : '-'}</td>
                                    <td className="px-8 py-5 text-slate-900 font-black text-sm">{formatCurrency(tenant.rent)}</td>
                                    <td className="px-8 py-5 text-slate-500 text-sm font-medium">
                                        <span>{formatDate(tenant.paymentSummary?.last_paid_at)}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-bold ${Number(tenant.paymentSummary?.pending_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {formatCurrency(tenant.paymentSummary?.pending_amount || 0)}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {tenant.paymentSummary?.current_month_amount ? `of ${formatCurrency(tenant.paymentSummary.current_month_amount)}` : 'No dues'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <PaymentBadge status={tenant.paymentSummary?.payment_status} />
                                    </td>
                                    <td className="px-8 py-5">
                                        <StatusBadge status={tenant.status} />
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {tenant.status === 'INVITED' && (<>
                                                <button
                                                    onClick={(e) => onEditInvitation(tenant, e)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-700 hover:bg-slate-50 border border-slate-200 bg-white"
                                                    title="Edit Invitation"
                                                >
                                                    <Save size={14} /> Edit
                                                </button>
                                                <button
                                                    onClick={(e) => onResendInvitation(tenant, e)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-indigo-600 hover:bg-indigo-50 border border-indigo-200 bg-indigo-50/50"
                                                    title="Resend Invitation"
                                                >
                                                    <RefreshCw size={14} /> Resend
                                                </button>
                                                <button
                                                    onClick={(e) => onCancelInvitation(tenant, e)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-rose-600 hover:bg-rose-50 border border-rose-200 bg-rose-50/50"
                                                    title="Cancel Invitation"
                                                >
                                                    <XCircle size={14} /> Cancel
                                                </button>
                                            </>)}
                                            {(tenant.status === 'LEFT') && (
                                                <button
                                                    onClick={(e) => onToggleStatus(tenant, e)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tenant.status === 'ACTIVE'
                                                        ? 'text-amber-600 hover:bg-amber-50 border border-amber-200 bg-amber-50/50'
                                                        : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200 bg-emerald-50/50'
                                                        }`}
                                                    title={tenant.status === 'ACTIVE' ? 'Mark as Left' : 'Reactivate'}
                                                >
                                                    {tenant.status === 'ACTIVE'
                                                        ? <><ToggleLeft size={15} /> Mark Left</>
                                                        : <><ToggleRight size={15} /> Activate</>}
                                                </button>
                                            )}
                                            {(tenant.status === 'CANCELLED' || tenant.status === 'EXPIRED') && (
                                                <span className="text-xs text-slate-400 font-medium italic">
                                                    {tenant.status === 'CANCELLED' ? 'Invite cancelled' : 'Invite expired'}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="md:hidden space-y-4 p-4">
                    {tenants.map(tenant => (
                        <div 
                            key={tenant.id} 
                            onClick={() => onRowClick(tenant)}
                            className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50/80 transition-all active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-center">
                                <div className="font-black text-slate-900">{tenant.name}</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => onCallTenant(tenant.phone, e)}
                                        disabled={!tenant.phone || tenant.phone === 'N/A'}
                                        title={tenant.phone && tenant.phone !== 'N/A' ? `Call ${tenant.name}` : 'Phone number unavailable'}
                                        className={`p-2 rounded-lg border transition-all ${
                                            tenant.phone && tenant.phone !== 'N/A'
                                                ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                                                : 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                                        }`}
                                    >
                                        <Phone size={14} />
                                    </button>
                                    <div className="px-2.5 py-1 bg-slate-50 rounded-lg text-[11px] font-black text-slate-500 border border-slate-100 uppercase tracking-wider">
                                        Room {tenant.room}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roll Number</p>
                                    <p className="font-bold text-slate-700">{tenant.rollNumber || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year</p>
                                    <p className="font-bold text-slate-700">{tenant.yearOfStudy ? `${tenant.yearOfStudy} Year` : '-'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Rent</p>
                                    <p className="font-bold text-slate-900">{formatCurrency(tenant.rent)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dues Pending</p>
                                    <p className={`font-bold ${Number(tenant.paymentSummary?.pending_amount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {formatCurrency(tenant.paymentSummary?.pending_amount || 0)}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PaymentBadge status={tenant.paymentSummary?.payment_status} />
                                    <StatusBadge status={tenant.status} />
                                </div>
                                <div className="flex items-center gap-2">
                                    {tenant.status === 'INVITED' && (
                                        <>
                                            <button
                                                onClick={(e) => onEditInvitation(tenant, e)}
                                                className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 bg-slate-50 text-slate-600 border border-slate-100"
                                            >
                                                Edit Invite
                                            </button>
                                            <button
                                                onClick={(e) => onCancelInvitation(tenant, e)}
                                                className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 bg-rose-50 text-rose-600 border border-rose-100"
                                            >
                                                Cancel Invite
                                            </button>
                                        </>
                                    )}
                                    {(tenant.status === 'LEFT') && (
                                        <button
                                            onClick={(e) => onToggleStatus(tenant, e)}
                                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                                tenant.status === 'ACTIVE'
                                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            }`}
                                        >
                                            {tenant.status === 'ACTIVE' ? 'Mark Left' : 'Activate'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
