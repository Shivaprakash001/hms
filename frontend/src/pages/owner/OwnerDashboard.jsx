import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import {
    Users, BedDouble, Bed, Clock, ArrowUpRight, LayoutGrid, CreditCard, AlertTriangle, X
} from 'lucide-react';
import { dashboardService, addonService } from '../../api/services';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency, formatDate } from '../../utils/format';

const OwnerDashboard = () => {
    const navigate = useNavigate();
    const { preferences } = useAppPreferences();
    const [months, setMonths] = useState(6);

    const { data: unifiedRes, isLoading: loading } = useQuery({
        queryKey: ['dashboard', months],
        queryFn: () => dashboardService.getUnified(months),
        staleTime: 5 * 60 * 1000,
    });

    const { data: addonData } = useQuery({
        queryKey: ['addon-usage'],
        queryFn: () => addonService.getUsage(),
        staleTime: 2 * 60 * 1000,
    });

    const [alertDismissed, setAlertDismissed] = useState(false);
    const cronStopped = !alertDismissed && (addonData?.cron_stopped === true);

    const summary = useMemo(() => {
        const s = unifiedRes?.stats;
        if (!s) return {
            total_tenants: 0, active_tenants: 0, total_capacity: 0, vacant_beds: 0,
            pending_dues: 0, overdue_amount: 0, overdue_count: 0,
            rent_collected_this_month: 0, occupancy_rate: 0, net_profit: 0,
        };
        const revenue = Number(s.rent_collected_this_month ?? s.revenue ?? 0);
        const expensesThisMonth = Number(s.expenses_this_month ?? 0);
        return {
            total_tenants: s.total_tenants || 0,
            active_tenants: s.active_tenants || 0,
            total_capacity: s.total_capacity || 0,
            vacant_beds: s.vacant_beds || 0,
            pending_dues: s.pending_dues || 0,
            overdue_amount: s.overdue_amount || 0,
            overdue_count: s.overdue_count || 0,
            rent_collected_this_month: revenue,
            occupancy_rate: s.occupancy_rate || 0,
            net_profit: Number(s.net_profit ?? (revenue - expensesThisMonth)),
        };
    }, [unifiedRes]);

    const collectionData = useMemo(() => {
        const m = unifiedRes?.collectionData;
        if (!Array.isArray(m)) return [];
        return m.map((item) => ({
            month: item.month,
            collected: Number(item.collected ?? item.income ?? 0),
            due: Number(item.due ?? item.expenses ?? 0),
        }));
    }, [unifiedRes]);

    const recentActivity = useMemo(() => {
        const a = unifiedRes?.recentActivity;
        return Array.isArray(a) ? a : [];
    }, [unifiedRes]);

    if (loading) return <div className="p-8 text-center text-slate-400">Loading dashboard...</div>;

    const hasFinancialData = collectionData.some(
        (item) => Number(item.collected) > 0 || Number(item.due) > 0
    );

    return (
        <div className="space-y-8 relative pb-20">
            {/* Cron-stopped alert banner */}
            {cronStopped && (
                <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3.5">
                    <AlertTriangle size={18} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-rose-800">⚠️ Automatic reminders are paused</p>
                        <p className="text-xs text-rose-600 mt-0.5">Reminders stopped because you ran out of credits. Tenants may miss payment deadlines.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => navigate('/owner/settings')} className="text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
                            Buy Credits
                        </button>
                        <button onClick={() => setAlertDismissed(true)} className="text-rose-400 hover:text-rose-600 transition">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Overview</h2>
                    <p className="text-sm font-semibold text-slate-400 mt-1">Real-time property insights and performance.</p>
                </div>
            </div>

            {/* Target 4 Metric Boxes */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard 
                    icon={<ArrowUpRight />} 
                    label="Total Revenue" 
                    value={formatCurrency(summary.rent_collected_this_month, preferences)} 
                    color="emerald" 
                    badge={{ text: '+0%', type: 'success' }}
                />
                <StatCard 
                    icon={<Users />} 
                    label="Occupancy Rate" 
                    value={`${summary.occupancy_rate || 0}%`} 
                    color="purple" 
                    badge={{ text: `${summary.active_tenants} active`, type: 'info' }}
                />
                <StatCard 
                    icon={<Clock />} 
                    label="Pending Dues" 
                    value={formatCurrency(summary.pending_dues, preferences)} 
                    color="rose" 
                    badge={{ text: '0%', type: 'danger' }}
                />
                <StatCard 
                    icon={<LayoutGrid />} 
                    label="Net Profit" 
                    value={formatCurrency(summary.net_profit || 0, preferences)} 
                    color="pink" 
                    badge={{ text: '0%', type: 'info' }}
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Collection chart */}
                <div className="bg-white p-6 sm:p-7 rounded-[28px] border border-slate-100 shadow-sm min-w-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <h3 className="font-black text-slate-900 text-xl tracking-tight">Financial Performance</h3>
                            <p className="text-sm font-semibold text-slate-400 mt-1">Income vs Expenses over time</p>
                        </div>
                        <select
                            value={months}
                            onChange={(e) => setMonths(Number(e.target.value))}
                            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                        >
                            <option value={3}>Last 3 months</option>
                            <option value={6}>Last 6 months</option>
                            <option value={12}>Last 12 months</option>
                        </select>
                    </div>
                    <div className="h-[320px] min-h-[320px] w-full min-w-0">
                        {!hasFinancialData ? (
                            <div className="h-full w-full rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 flex items-center justify-center text-center px-6">
                                <div>
                                    <p className="text-sm font-extrabold text-slate-500">No financial data yet</p>
                                    <p className="text-xs font-semibold text-slate-400 mt-1">Add tenants, generate rent, or record payments to see trends.</p>
                                </div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={320} debounce={50}>
                                <BarChart data={collectionData} barGap={10} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrency(Math.round(v / 1000) * 1000, preferences)} width={120} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} formatter={(v) => formatCurrency(v, preferences)} />
                                    <Bar dataKey="due" name="Dues" fill="#e2e8f0" radius={[8, 8, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="collected" name="Collected" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 sm:p-7 rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="font-black text-slate-900 text-xl tracking-tight">Recent Activity</h3>
                        <p className="text-sm font-semibold text-slate-400 mt-1">Key movements and financial updates.</p>
                    </div>
                    <button
                        onClick={() => navigate('/owner/activities')}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                        <ArrowUpRight size={22} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    {recentActivity.length === 0 ? (
                        <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-24px">
                            <Clock size={40} className="mx-auto mb-3 text-slate-100" />
                            <p className="text-sm font-bold text-slate-300">No recent activity detected.</p>
                        </div>
                    ) : recentActivity.map((activity) => (
                        <div key={activity.id} className="flex gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-50 hover:bg-white hover:shadow-sm transition-all group">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-white border border-slate-200 text-indigo-600 shadow-sm group-hover:scale-105 transition-transform">
                                <ArrowUpRight size={18} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-0.5">
                                    <p className="text-sm font-extrabold text-slate-900">{activity.title || activity.event_type}</p>
                                    <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                                        {formatDate(activity.event_at, preferences, '')}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-500">{activity.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => navigate('/owner/activities')}
                    className="mt-8 w-full py-4 text-sm font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 rounded-2xl transition-all tracking-wide uppercase"
                >
                    Browse Full Activity Log
                </button>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color, badge }) => {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
        rose: { bg: 'bg-rose-50', text: 'text-rose-600', icon: 'text-rose-500' },
        pink: { bg: 'bg-pink-50', text: 'text-pink-600', icon: 'text-pink-500' },
    };
    
    const badgeColors = {
        success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        danger: 'bg-rose-50 text-rose-600 border-rose-100',
        info: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    };

    const style = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
            {badge && (
                <div className={`absolute top-3 sm:top-4 right-3 sm:right-4 px-1.5 sm:px-2 py-0.5 rounded-lg border ${badgeColors[badge.type] || badgeColors.info} text-[9px] sm:text-[10px] font-black flex items-center gap-1`}>
                    {badge.type === 'success' && <ArrowUpRight size={10} />}
                    {badge.type === 'danger' && <ArrowUpRight size={10} className="rotate-90" />}
                    {badge.text}
                </div>
            )}
            <div className="relative z-10 pt-1">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${style.bg} flex items-center justify-center ${style.text} mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                    {React.cloneElement(icon, { size: 20, className: "sm:size-[24px]" })}
                </div>
                <h4 className="text-slate-400 font-extrabold text-[9px] sm:text-[10px] uppercase tracking-wider mb-1">{label}</h4>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{value}</div>
            </div>
        </div>
    );
};

export default OwnerDashboard;
