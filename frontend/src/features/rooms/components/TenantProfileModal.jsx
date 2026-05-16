import React from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Phone, Mail, BedDouble, LayoutGrid, Calendar, Users, CreditCard } from 'lucide-react';
import { formatDate, formatCurrency } from '../../../utils/format';
import { useAppPreferences } from '../../../context/AppPreferencesContext';

const SummaryTile = ({ label, value, subtitle }) => (
    <div className="rounded-2xl border border-slate-100 p-4 bg-white">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
        {subtitle && <p className="text-xs font-medium text-slate-400 mt-2">{subtitle}</p>}
    </div>
);

const InfoTile = ({ label, value, icon: Icon }) => (
    <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
            <Icon size={14} />
            {label}
        </div>
        <p className="text-sm font-semibold text-slate-900 mt-3 break-all">{value}</p>
    </div>
);

export const TenantProfileModal = ({ tenant, profile, loading, onClose }) => {
    const { preferences } = useAppPreferences();
    const payments = profile?.recent_payments || [];
    const latestPayment = payments[0] || null;
    const formatDisplayDate = (value) => formatDate(value, preferences, 'N/A');

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
                <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900">{profile?.name || tenant?.name || 'Tenant Profile'}</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                {profile?.room_number ? `Room ${profile.room_number}` : 'No room assigned'} • Joined {formatDisplayDate(profile?.joined_at)}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-900 transition-colors">
                            <X size={22} />
                        </button>
                    </div>

                    <div className="overflow-y-auto p-6 space-y-6">
                        {loading ? (
                            <div className="py-20 text-center text-slate-400">
                                <Loader2 size={30} className="animate-spin mx-auto mb-3" />
                                <p className="text-sm font-medium">Loading tenant profile...</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Contact</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InfoTile label="Phone" value={profile?.phone || 'No phone'} icon={Phone} />
                                        <InfoTile label="Guardian" value={profile?.guardian_phone || 'No guardian phone'} icon={Phone} />
                                        <InfoTile label="Email" value={profile?.email || 'No email'} icon={Mail} />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Stay Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <InfoTile label="Room" value={profile?.room_number ?? 'Unassigned'} icon={BedDouble} />
                                        <InfoTile label="Floor" value={profile?.room_number ? (profile?.floor ?? 'N/A') : 'N/A'} icon={LayoutGrid} />
                                        <InfoTile label="Joined" value={formatDisplayDate(profile?.joined_at)} icon={Calendar} />
                                        <InfoTile label="Status" value={profile?.status || 'N/A'} icon={Users} />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Financials</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <SummaryTile label="Monthly Rent" value={formatCurrency(Number(profile?.rent || 0), preferences)} />
                                        <SummaryTile label="Total Paid" value={formatCurrency(Number(profile?.total_paid || 0), preferences)} />
                                        <SummaryTile label="Outstanding" value={formatCurrency(Number(profile?.outstanding || 0), preferences)} />
                                        <SummaryTile
                                            label="Last Payment"
                                            value={latestPayment ? formatCurrency(Number(latestPayment.amount || 0), preferences) : 'No payment'}
                                            subtitle={latestPayment ? formatDisplayDate(latestPayment.date) : 'No payment history'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Recent Payments</h4>
                                    <div className="space-y-3">
                                        {payments.length === 0 ? (
                                            <div className="rounded-2xl border-2 border-dashed border-slate-100 text-center py-10 text-slate-400 text-sm">
                                                No recent payments.
                                            </div>
                                        ) : (
                                            payments.map((payment) => (
                                                <div key={payment.id} className="rounded-2xl border border-slate-100 p-4 flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="font-bold text-slate-900">{formatCurrency(Number(payment.amount || 0), preferences)}</div>
                                                        <div className="text-sm text-slate-500 mt-1">
                                                            {formatDisplayDate(payment.date)} • {payment.method || 'Unknown method'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-100">
                                                            <CreditCard size={12} />
                                                            {payment.status || 'paid'}
                                                        </div>
                                                        {payment.reference_number && (
                                                            <div className="text-xs text-slate-400 mt-2">{payment.reference_number}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    );
};
