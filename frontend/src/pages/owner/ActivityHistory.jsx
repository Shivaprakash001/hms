import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    ArrowLeft,
    Filter,
    Calendar,
    ChevronRight,
    Home,
    CreditCard,
    LogOut,
    X
} from 'lucide-react';
import { activityService } from '../../api/services';

const ActivityHistory = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState([]);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {
                limit: pageSize,
                offset: (page - 1) * pageSize
            };

            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (typeFilter !== 'all') params.event_type = typeFilter;
            if (dateFilter.start) params.start_date = dateFilter.start;
            if (dateFilter.end) params.end_date = dateFilter.end;

            const res = await activityService.getAll(params);
            setActivities(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total || 0));
        } catch (error) {
            console.error('Failed to fetch activity history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, searchTerm, typeFilter, dateFilter]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, typeFilter, dateFilter.start, dateFilter.end]);

    const getTypeIcon = (eventType) => {
        switch (eventType) {
            case 'PAYMENT_RECEIVED':
                return <CreditCard size={18} />;
            case 'TENANT_JOINED':
                return <Home size={18} />;
            case 'TENANT_LEFT':
                return <LogOut size={18} />;
            default:
                return <Filter size={18} />;
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
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

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by tenant, room, or detail..."
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
                            <option value="PAYMENT_RECEIVED">Payments Only</option>
                            <option value="TENANT_JOINED">Tenant Joined</option>
                            <option value="TENANT_LEFT">Tenant Left</option>
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
                            onChange={(e) => setDateFilter((prev) => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-slate-300">to</span>
                        <input
                            type="date"
                            className="flex-1 sm:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter((prev) => ({ ...prev, end: e.target.value }))}
                        />
                        {(dateFilter.start || dateFilter.end) && (
                            <button
                                onClick={() => setDateFilter({ start: '', end: '' })}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-tighter inline-flex items-center gap-1"
                            >
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="py-12 text-center text-slate-400">Loading details...</div>
                ) : activities.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                        No activities found matching your filters.
                    </div>
                ) : (
                    activities.map((act) => (
                        <div
                            key={act.id}
                            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-4"
                        >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                                {getTypeIcon(act.event_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h4 className="font-bold text-slate-900 truncate">{act.tenant_name || 'Tenant'}</h4>
                                    <span className="text-[10px] sm:text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                        {act.event_at ? new Date(act.event_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                    </span>
                                </div>
                                <p className="text-sm text-indigo-600 font-semibold mb-1 flex items-center gap-1.5">
                                    {act.title || act.event_type}
                                    <ChevronRight size={14} className="text-slate-300" />
                                </p>
                                <p className="text-xs text-slate-500 leading-relaxed truncate">{act.detail}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {!loading && total > 0 && (
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500">
                        Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityHistory;
