import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, CreditCard, Clock, Bell, ArrowUpRight, BedDouble, Calendar, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../api/services';

const StudentDashboard = () => {
    const { user } = useAuth();

    const [dues, setDues] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDues = async () => {
            if (!user?.student_id) return;
            try {
                const response = await paymentService.getStudentHistory(user.student_id);
                setDues(response || []);
            } catch (error) {
                console.error("Failed to fetch dues:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDues();
    }, [user]);

    // Calculate dues
    const pendingDues = dues
        .filter(p => p.status === 'pending' || p.status === 'overdue')
        .reduce((sum, p) => sum + p.amount, 0);

    // Get last payment date
    const lastPayment = dues
        .filter(p => p.status === 'paid')
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date || 'N/A';

    const student = {
        name: user?.name,
        room: user?.roomId,
        floor: user?.floorId ? `Floor ${user.floorId}` : 'Unassigned',
        rent: user?.rent || 0,
        due: pendingDues,
        lastPayment: lastPayment
    };

    // Using static announcements for now as they are general
    const announcements = [
        { id: 1, title: "Maintenance Schedule", date: "2 hrs ago", desc: "Water tank cleaning on Sunday 10 AM." },
        { id: 2, title: "Mess Menu Updated", date: "1 day ago", desc: "New winter special menu is live." }
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Hello, {student.name} 👋</h1>
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
                    { label: 'Room Number', val: student.room, sub: student.floor, icon: Home, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Monthly Rent', val: `₹${student.rent}`, sub: 'Due on 5th', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending Dues', val: `₹${student.due}`, sub: 'Pay immediately', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Next Payment', val: '5 Nov', sub: 'In 20 days', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' }
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
                            {stat.label === 'Pending Dues' && <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">Due</span>}
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
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Occupied</span>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-2">
                                <BedDouble className="text-indigo-500" size={20} />
                                <span className="font-semibold text-slate-700">Room Configuration</span>
                            </div>
                            <p className="text-slate-600 text-sm">Double Sharing, AC, Attached Washroom</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-2">
                                <User className="text-indigo-500" size={20} /> {/* Fix: User import needed if used, using text for now */}
                                <span className="font-semibold text-slate-700">Roommate</span>
                            </div>
                            <p className="text-slate-600 text-sm">Rahul Sharma (Computer Science)</p>
                        </div>
                    </div>
                </div>

                {/* Announcements */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Announcements</h3>
                        <Bell size={18} className="text-slate-400" />
                    </div>
                    <div className="p-0">
                        {announcements.map((item) => (
                            <div key={item.id} className="p-5 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold text-slate-800 text-sm">{item.title}</h4>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.date}</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-slate-100">
                        <button className="w-full text-center text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                            View All Notices
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};



export default StudentDashboard;
