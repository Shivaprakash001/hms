import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Users, 
    TrendingUp, 
    Search, 
    ArrowLeft, 
    Filter, 
    Calendar,
    ChevronRight,
    Home,
    MoveHorizontal,
    CreditCard
} from 'lucide-react';
import { allocationService, paymentService } from '../../api/services';

const ActivityHistory = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [paymentsRes, activeAllocations] = await Promise.all([
                paymentService.getAll({ limit: 100 }),
                allocationService.getAllActive()
            ]);

            const payments = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.payments || []);
            const allLocal = [];

            // Payments
            payments.forEach(p => {
                allLocal.push({
                    id: `pay_${p.id}`,
                    type: 'payment',
                    title: 'Payment Received',
                    user: p.student_name,
                    detail: `Paid ₹${p.amount_paid} via ${p.payment_method}`,
                    date: new Date(p.payment_date),
                    icon: CreditCard,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50'
                });
            });

            // Allocations
            (activeAllocations || []).forEach(a => {
                const startDate = new Date(a.start_date);
                allLocal.push({
                    id: `alloc_${a.id}`,
                    type: 'allocation',
                    title: 'Room Allocation',
                    user: a.student?.profiles?.name || 'New Tenant',
                    detail: `Allocated to Room ${a.room?.room_no}`,
                    date: startDate,
                    icon: Home,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50'
                });
            });

            allLocal.sort((a, b) => b.date - a.date);
            setActivities(allLocal);
            setFilteredActivities(allLocal);
        } catch (error) {
            console.error("Failed to fetch activity history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        let filtered = activities.filter(act => {
            const matchesSearch = 
                act.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                act.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                act.title.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesType = typeFilter === 'all' || act.type === typeFilter;
            
            const actDate = act.date.toISOString().split('T')[0];
            const matchesStart = !dateFilter.start || actDate >= dateFilter.start;
            const matchesEnd = !dateFilter.end || actDate <= dateFilter.end;

            return matchesSearch && matchesType && matchesStart && matchesEnd;
        });
        setFilteredActivities(filtered);
    }, [searchTerm, typeFilter, dateFilter, activities]);

    const getTypeIcon = (type) => {
        switch(type) {
            case 'payment': return <TrendingUp size={18} />;
            case 'allocation': return <Users size={18} />;
            default: return <Filter size={18} />;
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Activity History</h2>
                        <p className="text-sm text-slate-500">Comprehensive logs of all property events.</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input 
                            type="text"
                            placeholder="Search by name, room, or detail..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <select 
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <option value="all">All Activities</option>
                            <option value="payment">Payments Only</option>
                            <option value="allocation">Allocations Only</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <Calendar size={14} />
                        <span>Filter by Date</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input 
                            type="date"
                            className="flex-1 sm:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-slate-300">to</span>
                        <input 
                            type="date"
                            className="flex-1 sm:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                        />
                        {(dateFilter.start || dateFilter.end) && (
                            <button 
                                onClick={() => setDateFilter({ start: '', end: '' })}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-tighter"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Activity List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="py-12 text-center text-slate-400">Loading details...</div>
                ) : filteredActivities.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                        No activities found matching your filters.
                    </div>
                ) : (
                    filteredActivities.map((act) => (
                        <div 
                            key={act.id}
                            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-4"
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${act.bg} ${act.color} group-hover:scale-105 transition-transform`}>
                                <act.icon size={22} className="stroke-[2.5]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h4 className="font-bold text-slate-900 truncate">{act.user}</h4>
                                    <span className="text-[10px] sm:text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                        {act.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <p className="text-sm text-indigo-600 font-semibold mb-1 flex items-center gap-1.5">
                                    {act.title}
                                    <ChevronRight size={14} className="text-slate-300" />
                                </p>
                                <p className="text-xs text-slate-500 leading-relaxed truncate">{act.detail}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActivityHistory;
