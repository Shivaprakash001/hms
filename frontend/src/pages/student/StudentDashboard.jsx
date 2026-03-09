import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, CreditCard, Clock, Bell, BedDouble, Calendar, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../api/services';
import api from '../../api/axios';

const StudentDashboard = () => {
    const { user } = useAuth();

    const [dues, setDues] = useState({ obligations: [], outstanding_balance: 0 });
    const [roomData, setRoomData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.student_id) return;
            try {
                const [payRes, roomRes] = await Promise.allSettled([
                    paymentService.getStudentHistory(user.student_id),
                    api.get('/allocations/my-room')
                ]);
                if (payRes.status === 'fulfilled') setDues(payRes.value || { obligations: [], outstanding_balance: 0 });
                if (roomRes.status === 'fulfilled') setRoomData(roomRes.value?.data || null);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user]);

    // Calculate pending dues from obligations
    const pendingDues = dues.outstanding_balance || (dues.obligations || []).filter(o => o.status === 'pending' || o.status === 'partial' || o.status === 'overdue').reduce((sum, o) => sum + (o.amount || 0), 0);

    // Compute next payment from due_day
    const getNextPaymentDate = () => {
        const dueDay = user?.due_day;
        if (!dueDay) return 'N/A';
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        let next = new Date(year, month, dueDay);
        if (next <= now) {
            next = new Date(year, month + 1, dueDay);
        }
        const daysLeft = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
        const formatted = next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return { formatted, daysLeft };
    };

    const nextPayment = getNextPaymentDate();

    // Real data from backend
    const roomNo = user?.room_no || roomData?.room?.room_no;
    const roomCapacity = user?.room_capacity || roomData?.room?.capacity;
    const monthlyRent = user?.monthly_rent ?? 0;
    const dueDay = user?.due_day;

    // Roommate names from API
    const roommates = roomData?.roommates || [];

    // Room config from capacity
    const getRoomConfig = () => {
        if (!roomCapacity) return 'Not assigned';
        const types = { 1: 'Single Occupancy', 2: 'Double Sharing', 3: 'Triple Sharing', 4: 'Quad Sharing' };
        return types[roomCapacity] || `${roomCapacity}-bed Room`;
    };

    // Room occupied/vacant status
    const isOccupied = !!roomNo;

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Hello, {user?.name} 👋</h1>
                    <p className="text-slate-500">Here's what's happening in your hostel today.</p>

                    {(user?.status === 'Vacated' || user?.status === 'Shifted') && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                            <AlertCircle size={24} />
                            <div>
                                <p className="font-bold">Status: {user.status}</p>
                                <p className="text-sm">You have been {user.status.toLowerCase()} from your room.</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                        <CreditCard size={18} />
                        Pay Rent
                    </button>
                    <button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2">
                        <AlertCircle size={18} />
                        Raise Complaint
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        label: 'Room Number',
                        val: roomNo || 'Unassigned',
                        sub: roomNo ? `Capacity: ${roomCapacity}` : 'Not assigned yet',
                        icon: Home,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50'
                    },
                    {
                        label: 'Monthly Rent',
                        val: `₹${monthlyRent}`,
                        sub: dueDay ? `Due on ${dueDay}th` : 'No due date set',
                        icon: CreditCard,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50'
                    },
                    {
                        label: 'Pending Dues',
                        val: `₹${pendingDues}`,
                        sub: pendingDues > 0 ? 'Pay immediately' : 'All clear!',
                        icon: AlertCircle,
                        color: 'text-rose-600',
                        bg: 'bg-rose-50',
                        badge: pendingDues > 0
                    },
                    {
                        label: 'Next Payment',
                        val: typeof nextPayment === 'object' ? nextPayment.formatted : nextPayment,
                        sub: typeof nextPayment === 'object' ? `In ${nextPayment.daysLeft} days` : '',
                        icon: Calendar,
                        color: 'text-amber-600',
                        bg: 'bg-amber-50'
                    }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <stat.icon size={22} />
                            </div>
                            {stat.badge && <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">Due</span>}
                        </div>
                        <p className="text-slate-500 text-sm font-medium mb-1">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stat.val}</h3>
                        <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Room Details Card */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Room Details</h3>
                        <span className={`px-3 py-1 ${isOccupied ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'} text-xs font-bold rounded-full`}>
                            {isOccupied ? 'Occupied' : 'Unassigned'}
                        </span>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-2">
                                <BedDouble className="text-indigo-500" size={20} />
                                <span className="font-semibold text-slate-700">Room Configuration</span>
                            </div>
                            <p className="text-slate-600 text-sm">{getRoomConfig()}</p>
                            {roomNo && <p className="text-xs text-slate-400 mt-1">Room #{roomNo}</p>}
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-2">
                                <User className="text-indigo-500" size={20} />
                                <span className="font-semibold text-slate-700">
                                    Roommates {roommates.length > 0 ? `(${roommates.length})` : ''}
                                </span>
                            </div>
                            {roommates.length > 0 ? (
                                <div className="space-y-1">
                                    {roommates.map((r, idx) => (
                                        <p key={idx} className="text-slate-600 text-sm flex items-center gap-2">
                                            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-bold">
                                                {r.name.charAt(0).toUpperCase()}
                                            </span>
                                            {r.name}
                                        </p>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">{isOccupied ? 'No roommates' : 'Not assigned to a room'}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Announcements */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Announcements</h3>
                        <Bell size={18} className="text-slate-400" />
                    </div>
                    <div className="p-5 text-center text-slate-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No announcements yet</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
