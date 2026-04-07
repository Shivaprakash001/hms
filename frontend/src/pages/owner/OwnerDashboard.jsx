import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import {
    Users, BedDouble, Bed, Clock, ArrowUpRight, LayoutGrid, CreditCard
} from 'lucide-react';
import { activityService, dashboardService } from '../../api/services';

const OwnerDashboard = () => {
    const navigate = useNavigate();
    const [months, setMonths] = useState(6);
    const [summary, setSummary] = useState({
        total_tenants: 0,
        active_tenants: 0,
        total_capacity: 0,
        vacant_beds: 0,
        pending_dues: 0,
        overdue_amount: 0,
        overdue_count: 0,
        rent_collected_this_month: 0,
    });
    const [collectionData, setCollectionData] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    const updateDashboard = async () => {
        try {
            // Fetch summary and monthly stats in parallel
            const [summaryRes, monthlyRes] = await Promise.all([
                dashboardService.getSummary().catch(err => {
                    console.error('Summary fetch failed:', err);
                    return null;
                }),
                dashboardService.getMonthlyStats(months).catch(err => {
                    console.error('Monthly stats fetch failed:', err);
                    return [];
                })
            ]);

            if (summaryRes) {
                setSummary({
                    total_tenants: summaryRes.total_tenants || 0,
                    active_tenants: summaryRes.active_tenants || 0,
                    total_capacity: summaryRes.total_capacity || 0,
                    vacant_beds: summaryRes.vacant_beds || 0,
                    pending_dues: summaryRes.pending_dues || 0,
                    overdue_amount: summaryRes.overdue_amount || 0,
                    overdue_count: summaryRes.overdue_count || 0,
                    rent_collected_this_month: summaryRes.rent_collected_this_month || summaryRes.revenue || 0,
                });
            }

            const monthly = Array.isArray(monthlyRes) ? monthlyRes : [];
            const normalizedMonthly = monthly.map((item) => ({
                month: item.month,
                collected: Number(item.collected ?? item.income ?? 0),
                due: Number(item.due ?? item.expenses ?? 0),
            }));
            setCollectionData(normalizedMonthly);

            // Fetch activity separately as it is more prone to schema inconsistencies
            try {
                const activityRes = await activityService.getAll({ limit: 5, offset: 0 });
                const items = Array.isArray(activityRes?.items) ? activityRes.items : [];
                setRecentActivity(items);
            } catch (actErr) {
                console.error('Activity fetch failed:', actErr);
                setRecentActivity([]);
            }

        } catch (error) {
            console.error('Dashboard logic error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        updateDashboard();
        const interval = setInterval(updateDashboard, 20000);
        return () => clearInterval(interval);
    }, [months]);

    if (loading) return <div className="p-8 text-center text-slate-400">Loading dashboard...</div>;

    return (
        <div className="space-y-8 relative pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Property Overview</h2>
                    <p className="text-sm font-semibold text-slate-400 mt-1">Live metrics from your hostel management system.</p>
                </div>
            </div>

            {/* Premium Stats Grid (2x2) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    icon={<BedDouble />} 
                    label="Total Rooms" 
                    value={summary.total_rooms || 0} 
                    color="indigo" 
                />
                <StatCard 
                    icon={<Users />} 
                    label="Total Occupants" 
                    value={summary.active_tenants} 
                    color="purple" 
                />
                <StatCard 
                    icon={<Bed />} 
                    label="Total Capacity" 
                    value={summary.total_capacity} 
                    color="blue" 
                />
                <StatCard 
                    icon={<LayoutGrid />} 
                    label="Occupancy Rate" 
                    value={`${summary.occupancy_rate || 0}%`} 
                    color="emerald" 
                />
            </div>

            {/* Financial Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Pending Dues</p>
                            <h4 className="text-2xl font-black text-slate-900">₹{summary.pending_dues.toLocaleString()}</h4>
                        </div>
                    </div>
                    {summary.overdue_count > 0 && (
                        <div className="px-3 py-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-lg shadow-lg shadow-rose-200">
                            {summary.overdue_count} OVERDUE
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Rent Collected</p>
                            <h4 className="text-2xl font-black text-slate-900">₹{summary.rent_collected_this_month.toLocaleString()}</h4>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                        THIS MONTH
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Collection chart */}
                <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm min-w-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <h3 className="font-black text-slate-900 text-xl tracking-tight">Financial Performance</h3>
                            <p className="text-sm font-semibold text-slate-400 mt-1">Comparing monthly dues vs actual collections.</p>
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
                        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={280}>
                            <BarChart data={collectionData} barGap={10} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={55} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                                <Bar dataKey="due" name="Dues" fill="#e2e8f0" radius={[8, 8, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="collected" name="Collected" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="font-black text-slate-900 text-xl tracking-tight">Recent Activity</h3>
                        <p className="text-sm font-semibold text-slate-400 mt-1">Key movements and financial updates.</p>
                    </div>
                    <button
                        onClick={() => navigate('/owner/activity')}
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
                                        {activity.event_at ? new Date(activity.event_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-500">{activity.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => navigate('/owner/activity')}
                    className="mt-8 w-full py-4 text-sm font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 rounded-2xl transition-all tracking-wide uppercase"
                >
                    Browse Full Activity Log
                </button>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color }) => {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    };
    const style = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
            <div className={`absolute top-0 right-0 p-4 opacity-10 ${style.icon} group-hover:scale-110 transition-transform`}>
                {React.cloneElement(icon, { size: 64 })}
            </div>
            <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl ${style.bg} flex items-center justify-center ${style.text} mb-5 group-hover:scale-110 transition-transform`}>
                    {React.cloneElement(icon, { size: 28 })}
                </div>
                <h4 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1.5">{label}</h4>
                <div className="text-4xl font-black text-slate-900 tracking-tight">{value}</div>
            </div>
        </div>
    );
};

export default OwnerDashboard;
