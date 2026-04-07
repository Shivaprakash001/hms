import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import {
    Users, BedDouble, Bed, Clock, ArrowUpRight
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
        <div className="space-y-6 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
                    <p className="text-sm text-slate-500">Understand your hostel in seconds.</p>
                </div>
            </div>

            {/* Hostel Health */}
            <div className="grid grid-cols-2 gap-4">
                <MetricCard title="Total Tenants" value={summary.total_tenants} icon={Users} iconClass="text-indigo-600 bg-indigo-50" />
                <MetricCard title="Occupied Beds" value={summary.active_tenants} icon={BedDouble} iconClass="text-emerald-600 bg-emerald-50" />
                <MetricCard title="Vacant Beds" value={summary.vacant_beds} icon={Bed} iconClass="text-amber-600 bg-amber-50" />
                <MetricCard title="Pending Dues" value={`₹${summary.pending_dues.toLocaleString()}`} icon={Clock} iconClass="text-rose-600 bg-rose-50" />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Collection chart */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Rent Collected vs Rent Due</h3>
                            <p className="text-sm text-slate-500">Monthly collection discipline.</p>
                        </div>
                        <select
                            value={months}
                            onChange={(e) => setMonths(Number(e.target.value))}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={55} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                                <Bar dataKey="due" name="Dues" fill="#e2e8f0" radius={[6, 6, 0, 0]} maxBarSize={48} />
                                <Bar dataKey="collected" name="Collected" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 text-lg mb-1">Recent Activity</h3>
                <p className="text-sm text-slate-500 mb-5">What changed today.</p>
                <div className="space-y-4">
                    {recentActivity.length === 0 ? (
                        <div className="text-sm text-slate-400">No recent activity</div>
                    ) : recentActivity.map((activity) => (
                        <div key={activity.id} className="flex gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
                                <ArrowUpRight size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-semibold text-slate-900">{activity.title || activity.event_type}</p>
                                    <span className="text-[10px] text-slate-500">
                                        {activity.event_at ? new Date(activity.event_at).toLocaleDateString() : ''}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{activity.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => navigate('/owner/activity')}
                    className="mt-5 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                >
                    View Full History
                </button>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, icon: Icon, iconClass }) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-start mb-3">
            <div className={`p-2.5 rounded-xl ${iconClass}`}>
                <Icon size={18} />
            </div>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
    </div>
);

export default OwnerDashboard;
