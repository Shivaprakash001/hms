import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Users, 
    Search, 
    ArrowLeft, 
    Calendar,
    ChevronRight,
    Home,
    Clock,
    UserMinus,
    ArrowUpRight
} from 'lucide-react';
import { allocationService } from '../../api/services';

const ActivityHistory = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const history = await allocationService.getHistory();
            
            const formatted = (history || []).map(a => {
                const isPast = !!a.end_date;
                return {
                    id: a.id,
                    studentName: a.student?.profiles?.name || 'Unknown Tenant',
                    roomNo: a.room?.room_no || 'N/A',
                    startDate: new Date(a.start_date),
                    endDate: a.end_date ? new Date(a.end_date) : null,
                    isReallocation: a.is_reallocation || false, // We could detect this by checking if student has multiple segments
                    type: isPast ? 'EXIT' : 'ALLOCATION'
                };
            });

            // Detect reallocations (consecutive moves)
            // Group by student and check if there are multiple segments
            const grouped = {};
            formatted.forEach(f => {
                if(!grouped[f.studentName]) grouped[f.studentName] = [];
                grouped[f.studentName].push(f);
            });
            
            formatted.forEach(f => {
                const studentHistory = grouped[f.studentName];
                if (studentHistory && studentHistory.length > 1) {
                    // If not the very first (oldest) allocation, let's call it a reallocation/move
                    const sorted = [...studentHistory].sort((a,b) => a.startDate - b.startDate);
                    if (f.id !== sorted[0].id) {
                        f.isReallocation = true;
                    }
                }
            });

            setActivities(formatted.sort((a,b) => b.startDate - a.startDate));
            setFilteredActivities(formatted);
        } catch (error) {
            console.error("Failed to fetch allocation history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        let filtered = activities.filter(act => {
            const actDate = act.startDate.toISOString().split('T')[0];
            const matchesStart = !dateFilter.start || actDate >= dateFilter.start;
            const matchesEnd = !dateFilter.end || actDate <= dateFilter.end;
            return matchesStart && matchesEnd;
        });
        setFilteredActivities(filtered);
    }, [dateFilter, activities]);

    const getStatusTheme = (act) => {
        if (act.type === 'EXIT') return { bg: 'bg-rose-50', color: 'text-rose-600', icon: UserMinus, label: 'Vacated' };
        if (act.isReallocation) return { bg: 'bg-amber-50', color: 'text-amber-600', icon: Clock, label: 'Re-allocated' };
        return { bg: 'bg-indigo-50', color: 'text-indigo-600', icon: Home, label: 'First Allocation' };
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Elegant Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="flex items-center gap-5">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-slate-500 transition-all shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tenant Movement</h2>
                        <p className="text-sm text-slate-500 mt-1 font-medium italic">Tracking every allocation and relocation.</p>
                    </div>
                </div>

                {/* Simplified Date Filter */}
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                    <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl gap-3">
                        <Calendar size={16} className="text-indigo-400" />
                        <input 
                            type="date"
                            className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28"
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                        />
                    </div>
                    <span className="text-slate-300 font-bold">→</span>
                    <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl gap-3">
                        <input 
                            type="date"
                            className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28"
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                    {(dateFilter.start || dateFilter.end) && (
                        <button 
                            onClick={() => setDateFilter({ start: '', end: '' })}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                            <UserMinus size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Log List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-400 animate-pulse">Retrieving Logs...</p>
                    </div>
                ) : filteredActivities.length === 0 ? (
                    <div className="bg-white p-16 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                            <Search size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold">No movements recorded during this period.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredActivities.map((act) => {
                            const theme = getStatusTheme(act);
                            return (
                                <div 
                                    key={act.id}
                                    className="group bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex items-center gap-6 relative overflow-hidden"
                                >
                                    {/* Sidebar indicator */}
                                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${theme.color.replace('text', 'bg')}`}></div>

                                    {/* Icon Box */}
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${theme.bg} ${theme.color} group-hover:scale-110 transition-transform shadow-sm`}>
                                        <theme.icon size={26} className="stroke-[2]" />
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                                {act.studentName}
                                            </h4>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1">Movement Date</span>
                                                <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                                    {act.startDate.toLocaleDateString(undefined, { 
                                                        month: 'long', 
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 mt-3">
                                            <div className={`px-4 py-1.5 rounded-xl ${theme.bg} ${theme.color} text-[10px] font-black uppercase tracking-widest border border-current opacity-70`}>
                                                {theme.label}
                                            </div>
                                            <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                                            <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                                <span className="text-slate-400">Target:</span>
                                                <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">Room {act.roomNo}</span>
                                            </p>
                                        </div>

                                        {act.endDate && (
                                            <p className="text-[10px] font-bold text-rose-400 mt-2 flex items-center gap-1.5 uppercase">
                                                <ChevronRight size={12} /> Vacated on {act.endDate.toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>

                                    {/* Detail Button (Hidden on Mobile) */}
                                    <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        <ArrowUpRight size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityHistory;
