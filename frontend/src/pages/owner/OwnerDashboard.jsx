import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bed, Users, Clock, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { allocationService, paymentService, expenseService, dashboardService } from '../../api/services';

const OwnerDashboard = () => {
    // State
    const [monthlyData, setMonthlyData] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [allActivities, setAllActivities] = useState([]);
    const [showFinancialModal, setShowFinancialModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState([
        { title: 'Total Revenue', value: '₹0', trend: '0%', trendUp: true, icon: TrendingUp },
        { title: 'Occupancy Rate', value: '0%', trend: '0%', trendUp: true, icon: Users },
        { title: 'Pending Dues', value: '₹0', trend: '0%', trendUp: false, icon: Clock },
        { title: 'Total Expenses', value: '₹0', trend: '0%', trendUp: false, icon: TrendingDown },
    ]);

    const updateDashboard = async () => {
        try {
            // Fetch real data in parallel
            const [statsRes, activeAllocations, paymentsRes, expensesRes, monthlyRes] = await Promise.all([
                dashboardService.getStats(),
                allocationService.getAllActive(), // For activity feed
                paymentService.getAll({ limit: 10 }), // For activity feed
                expenseService.getAll(), // For charts/modals
                dashboardService.getMonthlyStats(6) // Real Chart data
            ]);

            const dashboardStats = statsRes || {};
            const payments = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.payments || []);

            // 4. Process Expenses for Modal/Chart
            const expenseList = Array.isArray(expensesRes) ? expensesRes : [];
            setExpenses(expenseList);

            // Updated Stats from Backend
            setStats([
                {
                    title: 'Total Revenue',
                    value: `₹${(dashboardStats.revenue || 0).toLocaleString()}`,
                    trend: '+0%', // Backend doesn't provide trend yet
                    trendUp: true,
                    icon: TrendingUp,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50'
                },
                {
                    title: 'Occupancy Rate',
                    value: `${dashboardStats.occupancy_rate || 0}%`,
                    trend: `${dashboardStats.active_tenants || 0} active`,
                    trendUp: true,
                    icon: Users,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50'
                },
                {
                    title: 'Pending Dues',
                    value: `₹${(dashboardStats.pending_dues || 0).toLocaleString()}`,
                    trend: '0%',
                    trendUp: false,
                    icon: Clock,
                    color: 'text-rose-600',
                    bg: 'bg-rose-50'
                },
                {
                    title: 'Net Profit',
                    value: `₹${(dashboardStats.net_profit || 0).toLocaleString()}`,
                    trend: '0%',
                    trendUp: true,
                    icon: Activity,
                    color: 'text-violet-600',
                    bg: 'bg-violet-50',
                    onClick: () => setShowFinancialModal(true),
                    cursor: 'cursor-pointer'
                },
            ]);

            // 6. Recent Activity
            const activities = [];
            const now = new Date();

            // Payments
            payments.slice(0, 5).forEach(p => {
                activities.push({
                    id: `pay_${p.id}`,
                    action: 'Payment Received',
                    detail: `${p.student_name} paid ₹${p.amount_paid}`,
                    date: new Date(p.payment_date),
                    icon: TrendingUp,
                    color: 'text-green-600',
                    bg: 'bg-green-50'
                });
            });
            // New Tenants (Allocations)
            (activeAllocations || []).slice(0, 5).forEach(a => {
                // Check if recent
                const start = new Date(a.start_date);
                if ((now - start) < 7 * 24 * 60 * 60 * 1000) { // last 7 days
                    activities.push({
                        id: `alloc_${a.id}`,
                        action: 'New Tenant',
                        detail: `New tenant in Room ${a.room?.room_no}`,
                        date: start,
                        icon: Users,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50'
                    });
                }
            });

            activities.sort((a, b) => b.date - a.date);

            const formattedActivities = activities.map(act => {
                const diffTime = Math.abs(new Date() - act.date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let timeStr = diffDays <= 1 ? 'Today' : `${diffDays} days ago`;
                return { ...act, time: timeStr };
            });

            setRecentActivity(formattedActivities.slice(0, 5));
            setAllActivities(formattedActivities);

            // 7. Chart Data
            let monthData = [];
            if (Array.isArray(monthlyRes)) {
                monthData = monthlyRes;
            } else if (monthlyRes?.data && Array.isArray(monthlyRes.data)) {
                monthData = monthlyRes.data;
            } else {
                // Fallback to empty mock
                const last6Months = [];
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    last6Months.push({
                        month: date.toLocaleString('default', { month: 'short' }),
                        income: 0,
                        expenses: 0
                    });
                }
                monthData = last6Months;
            }
            setMonthlyData(monthData);

        } catch (e) {
            console.error("Dashboard update failed:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        updateDashboard();
        const interval = setInterval(updateDashboard, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, []);

    // Helper Modal Component
    const Modal = ({ isOpen, onClose, title, children }) => {
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-lg text-slate-800">{title}</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <ArrowDownRight className="rotate-45" size={20} />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading dashboard...</div>;

    return (
        <div className="space-y-6 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
                    <p className="text-sm text-slate-500">Real-time property insights and performance.</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={idx}
                            onClick={stat.onClick}
                            className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 ${stat.cursor || ''} ${stat.onClick ? 'active:scale-95' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <Icon size={22} className="stroke-[2.5]" />
                                </div>
                                <span className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${stat.trendUp ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                    {stat.trendUp ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
                                    {stat.trend}
                                </span>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.title}</p>
                                <h3 className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{stat.value}</h3>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Financial Performance</h3>
                            <p className="text-sm text-slate-500">Income vs Expenses over time</p>
                        </div>
                        <select className="text-sm border-none bg-slate-50 text-slate-600 font-medium rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-100 outline-none">
                            <option>Last 6 Months</option>
                            <option>Last Year</option>
                        </select>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} tickFormatter={(value) => `₹${value / 1000}k`} dx={-10} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-800 backdrop-blur-md bg-slate-900/95">
                                                <p className="font-bold mb-2 text-slate-300">{label}</p>
                                                <div className="flex items-center justify-between gap-4 mb-1.5">
                                                    <span className="text-indigo-400 font-medium">Income</span>
                                                    <span className="font-mono font-bold">₹{payload[0].value.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-slate-400 font-medium">Expenses</span>
                                                    <span className="font-mono font-bold">₹{payload[1].value.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <Bar dataKey="income" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                <Bar dataKey="expenses" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">Recent Activity</h3>
                    <p className="text-sm text-slate-500 mb-6">Latest updates from your property.</p>
                    <div className="flex-1 space-y-6">
                        {recentActivity.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-4">No recent activity</div>
                        ) : (
                            recentActivity.map((activity) => (
                                <div key={activity.id} className="flex gap-4 group cursor-pointer">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${activity.bg} ${activity.color} group-hover:scale-105 transition-transform`}>
                                        <activity.icon size={20} className="stroke-[2.5]" />
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{activity.action}</p>
                                            <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-full">{activity.time}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{activity.detail}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className="mt-8 w-full py-3 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        View Full History <ArrowUpRight size={16} />
                    </button>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={showFinancialModal} onClose={() => setShowFinancialModal(false)} title="Financial Breakdown">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <p className="text-emerald-600 text-xs font-bold uppercase">Total Income</p>
                            <p className="text-2xl font-bold text-emerald-700 mt-1">
                                {stats.find(s => s.title === 'Total Revenue')?.value}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1">Rent Collected (This Month)</p>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                            <p className="text-rose-600 text-xs font-bold uppercase">Total Expenses</p>
                            <p className="text-2xl font-bold text-rose-700 mt-1">
                                {`₹${(expenses || [])
                                    .reduce((sum, e) => sum + e.amount, 0).toLocaleString()}`}
                            </p>
                            <p className="text-xs text-rose-600 mt-1">Maintenance & Utilities</p>
                        </div>
                        <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                            <p className="text-violet-600 text-xs font-bold uppercase">Net Profit</p>
                            <p className="text-2xl font-bold text-violet-700 mt-1">
                                {stats.find(s => s.title === 'Net Profit')?.value}
                            </p>
                            <p className="text-xs text-violet-600 mt-1">Income - Expenses</p>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Full Activity History">
                <div className="space-y-4">
                    {allActivities.map((activity) => (
                        <div key={activity.id} className="flex gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${activity.bg} ${activity.color}`}>
                                <activity.icon size={20} className="stroke-[2.5]" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-900">{activity.action}</p>
                                    <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-full">{activity.time}</span>
                                </div>
                                <p className="text-sm text-slate-600 mt-1">{activity.detail}</p>
                                <p className="text-xs text-slate-400 mt-2">{activity.date.toLocaleDateString()} at {activity.date.toLocaleTimeString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default OwnerDashboard;
