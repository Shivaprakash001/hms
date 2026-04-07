import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell
} from 'recharts';
import {
    Users, BedDouble, Bed, Clock, AlertCircle, ArrowUpRight,
    UserPlus, CreditCard, Zap
} from 'lucide-react';
import { allocationService, paymentService, dashboardService } from '../../api/services';

const PIE_COLORS = ['#6366f1', '#cbd5e1'];

const OwnerDashboard = () => {
    const navigate = useNavigate();
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
    const [allActivities, setAllActivities] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const updateDashboard = async () => {
        try {
            const [summaryRes, activeAllocations, paymentsRes, monthlyRes] = await Promise.all([
                dashboardService.getSummary(),
                allocationService.getAllActive(),
                paymentService.getAll({ limit: 10 }),
                dashboardService.getMonthlyStats(6)
            ]);

            const stats = summaryRes || {};
            setSummary({
                total_tenants: stats.total_tenants || 0,
                active_tenants: stats.active_tenants || 0,
                total_capacity: stats.total_capacity || 0,
                vacant_beds: stats.vacant_beds || 0,
                pending_dues: stats.pending_dues || 0,
                overdue_amount: stats.overdue_amount || 0,
                overdue_count: stats.overdue_count || 0,
                rent_collected_this_month: stats.rent_collected_this_month || stats.revenue || 0,
            });

            const monthly = Array.isArray(monthlyRes) ? monthlyRes : [];
            const normalizedMonthly = monthly.map((item) => ({
                month: item.month,
                collected: Number(item.collected ?? item.income ?? 0),
                due: Number(item.due ?? item.expenses ?? 0),
            }));
            setCollectionData(normalizedMonthly);

            const payments = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.payments || []);
            const activities = [];
            const now = new Date();

            payments.slice(0, 5).forEach((p) => {
                activities.push({
                    id: `pay_${p.id}`,
                    action: 'Payment received',
                    detail: `${p.student_name} paid ₹${Number(p.amount_paid || 0).toLocaleString()}`,
                    date: new Date(p.payment_date || p.created_at || Date.now()),
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50'
                });
            });

            (activeAllocations || []).slice(0, 5).forEach((a) => {
                const start = new Date(a.start_date);
                if ((now - start) < 7 * 24 * 60 * 60 * 1000) {
                    activities.push({
                        id: `alloc_${a.id}`,
                        action: 'New tenant joined',
                        detail: `${a.student?.profiles?.name || 'Tenant'} joined Room ${a.room?.room_no || 'N/A'}`,
                        date: start,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50'
                    });
                }
            });

            activities.sort((a, b) => b.date - a.date);
            const formatted = activities.map((act) => {
                const diffDays = Math.ceil(Math.abs(new Date() - act.date) / (1000 * 60 * 60 * 24));
                return { ...act, time: diffDays <= 1 ? 'Today' : `${diffDays} days ago` };
            });

            setRecentActivity(formatted.slice(0, 5));
            setAllActivities(formatted);
        } catch (error) {
            console.error('Dashboard update failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        updateDashboard();
        const interval = setInterval(updateDashboard, 20000);
        return () => clearInterval(interval);
    }, []);

    const occupancyData = useMemo(() => ([
        { name: 'Occupied', value: Number(summary.active_tenants || 0) },
        { name: 'Vacant', value: Number(summary.vacant_beds || 0) },
    ]), [summary.active_tenants, summary.vacant_beds]);

    const alerts = useMemo(() => {
        const list = [];
        if (summary.overdue_count > 0) {
            list.push(`⚠ ${summary.overdue_count} rent obligation(s) overdue (₹${summary.overdue_amount.toLocaleString()})`);
        }
        if (summary.vacant_beds > 0) {
            list.push(`⚠ ${summary.vacant_beds} bed(s) are currently vacant`);
        }
        if (summary.pending_dues > 0) {
            list.push(`⚠ Pending dues total ₹${summary.pending_dues.toLocaleString()}`);
        }
        return list;
    }, [summary]);

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
                {/* Collection chart - Full Width */}
                <div className="bg-white p-4 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-w-0">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Financial Health: Rent Collection Trend</h3>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Monthly collection vs projected receivables.</p>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={collectionData} barGap={12}>
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
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activity.bg} ${activity.color}`}>
                                <ArrowUpRight size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
                                    <span className="text-[10px] text-slate-500">{activity.time}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{activity.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
                {allActivities.length > 0 && (
                    <button
                        onClick={() => navigate('/owner/activities')}
                        className="mt-5 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                    >
                        View Full History
                    </button>
                )}
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

const ActionBtn = ({ onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-sm font-semibold"
    >
        <Icon size={16} />
        {label}
    </button>
);

export default OwnerDashboard;
