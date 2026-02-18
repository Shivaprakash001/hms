import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Phone, Home, CreditCard, Calendar, CheckCircle2, AlertCircle, X, Save, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { getFloors, addTenantToRoom, updateTenant } from '../../utils/storageUtils';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

export default function ManageStudents() {
    const { user, loading: authLoading } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);
    const [isMockMode, setIsMockMode] = useState(false);
    const API_BASE_URL = "/api";

    useEffect(() => {
        if (!authLoading) {
            fetchStudents();
        }
    }, [authLoading, user]); // Refetch when user/auth state changes

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const token = user?.token || JSON.parse(localStorage.getItem('ownerUser'))?.token;

            if (!token) {
                // If no token, maybe we are just logged out or in a weird state
                setLoading(false);
                return;
            }

            const response = await axios.get('/api/students/', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = response.data.students.map(s => ({
                id: s.id,
                name: s.profile?.name || 'Unknown',
                room: s.current_room?.room?.number || 'N/A', // Check nesting: current_room might be allocation obj
                floor: 'N/A',
                phone: s.profile?.phone || 'N/A',
                status: s.status,
                rent: s.monthly_rent,
                joinDate: s.joined_on
            }));

            setStudents(data);
            setIsMockMode(false);
        } catch (error) {
            console.error("Failed to fetch students:", error);
            // Fallback to local storage/mock if API fails? 
            // For now, let's keep it clean or maybe show empty
            if (process.env.NODE_ENV === 'development') {
                // Option: fallback to mock if dev and api fails? 
                // stick to error state for now to verify integration
            }
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.phone && student.phone.includes(searchTerm))
    );

    // Stats Calculation
    const stats = {
        total: students.length,
        occupiedRooms: new Set(students.map(s => s.room)).size,
        paid: students.filter(s => s.status === 'Paid').length,
        pending: students.filter(s => s.status === 'Pending').length
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getInitials = (name) => {
        return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    };

    return (
        <div className="font-sans">
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tenant Management</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your property tenants and track payments</p>
                    </div>
                    {isMockMode && (
                        <div className="sm:hidden mb-2">
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                                <AlertCircle size={14} /> Offline Mode
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        {isMockMode && (
                            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                                <AlertCircle size={14} /> Offline Mode
                            </span>
                        )}
                        <button
                            onClick={() => { setStudentToEdit(null); setShowAddModal(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <Plus size={18} />
                            Add Tenant
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Total Tenants"
                        value={stats.total}
                        icon={User}
                        iconBg="bg-indigo-50"
                        iconColor="text-indigo-600"
                    />
                    <StatCard
                        title="Occupied Rooms"
                        value={stats.occupiedRooms}
                        icon={Home}
                        iconBg="bg-indigo-50"
                        iconColor="text-indigo-600"
                    />
                    <StatCard
                        title="Paid This Month"
                        value={stats.paid}
                        icon={CheckCircle2}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        isCurrency={false}
                    />
                    <StatCard
                        title="Pending Payment"
                        value={stats.pending}
                        icon={AlertCircle}
                        iconBg="bg-amber-50"
                        iconColor="text-amber-600"
                        isCurrency={false}
                    />
                </div>

                {/* Search Bar */}
                <div className="relative max-w-2xl group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, room number, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all text-slate-700 font-medium shadow-sm placeholder:text-slate-400"
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="overflow-x-auto">
                        <table className="w-full hidden md:table">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {['NAME', 'ROOM', 'PHONE', 'STATUS', 'RENT', 'JOIN DATE'].map((header) => (
                                        <th key={header} className="px-8 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-12 text-center text-slate-400 font-medium animate-pulse">
                                            Loading tenants...
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-16 text-center text-slate-400">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <User size={24} className="text-slate-300" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-700 mb-1">No tenants found</h3>
                                            <p className="text-sm font-medium">Try adjusting your search or add a new tenant</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <motion.tr
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            key={student.id}
                                            onClick={() => { setStudentToEdit(student); setShowAddModal(true); }}
                                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        {getInitials(student.name)}
                                                    </div>
                                                    <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{student.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-slate-600 font-bold text-sm">{student.room}</td>
                                            <td className="px-8 py-5 text-slate-500 text-sm font-medium">{student.phone}</td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${student.status === 'Paid'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                    }`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-slate-900 font-black text-sm">₹{student.rent?.toLocaleString()}</td>
                                            <td className="px-8 py-5 text-slate-500 text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span>{formatDate(student.joinDate)}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHistoryTenant({ tenantId: student.id, tenantName: student.name });
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ml-2"
                                                        title="View Payment History"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 p-4">
                            {loading ? (
                                <div className="text-center py-10 text-slate-400 font-medium animate-pulse">Loading tenants...</div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <User size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm font-medium">No tenants found</p>
                                </div>
                            ) : (
                                filteredStudents.map((student) => (
                                    <motion.div
                                        key={student.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => { setStudentToEdit(student); setShowAddModal(true); }}
                                        className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-4 active:scale-[0.99] transition-transform"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm">
                                                    {getInitials(student.name)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{student.name}</p>
                                                    <p className="text-xs text-slate-500 font-medium">Room {student.room}</p>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold ${student.status === 'Paid'
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                {student.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Phone</p>
                                                <p className="text-sm font-medium text-slate-700">{student.phone || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Rent</p>
                                                <p className="text-sm font-black text-slate-900">₹{student.rent?.toLocaleString()}</p>
                                            </div>
                                            <div className="col-span-2 flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Joined</p>
                                                    <p className="text-sm font-medium text-slate-700">{formatDate(student.joinDate)}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setHistoryTenant({ tenantId: student.id, tenantName: student.name });
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-100"
                                                    title="View Payment History"
                                                >
                                                    <History size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <AddStudentModal
                        onClose={() => setShowAddModal(false)}
                        initialData={studentToEdit}
                        refreshData={fetchStudents}
                        API_BASE_URL={API_BASE_URL}
                    />
                )}
            </AnimatePresence>

            {/* Tenant History Modal */}
            <TenantHistoryModal
                isOpen={!!historyTenant}
                onClose={() => setHistoryTenant(null)}
                tenantId={historyTenant?.tenantId}
                tenantName={historyTenant?.tenantName}
            />
        </div>
    );
}

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor, isCurrency = false }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">{title}</p>
            <h3 className="text-3xl font-black text-slate-900">{isCurrency ? '₹' : ''}{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
            <Icon size={24} strokeWidth={2.5} />
        </div>
    </div>
);

const AddStudentModal = ({ onClose, initialData, refreshData, API_BASE_URL }) => {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        phone: initialData?.phone || '',
        room: initialData?.room || '',
        rent: initialData?.rent || '',
        status: initialData?.status || 'Paid',
        joinDate: initialData?.joinDate || new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Find room ID based on room number (This is a bit tricky if room numbers aren't unique, but assuming they are for now)
            // In a real app we'd probably select room from a dropdown which gives us the ID
            // For now, let's look up the room ID from the floors
            const floors = getFloors();
            let roomId = null;
            let currentTenantId = initialData?.id;

            // Simple lookup
            for (const f of floors) {
                const r = f.rooms.find(r => r.number === formData.room);
                if (r) {
                    roomId = r.id;
                    break;
                }
            }

            if (!roomId) {
                throw new Error("Room not found. Please verify room number.");
            }

            if (initialData) {
                // Update existing
                updateTenant(currentTenantId, {
                    name: formData.name,
                    phone: formData.phone,
                    rent: Number(formData.rent),
                    status: formData.status,
                    joinDate: formData.joinDate
                    // Note: Changing room is harder, not handling that simple update for now
                });
                alert("Tenant updated successfully!");
            } else {
                // Add new
                const newTenant = {
                    name: formData.name,
                    phone: formData.phone,
                    rent: Number(formData.rent),
                    status: formData.status,
                    joinDate: formData.joinDate,
                    email: `${formData.name.toLowerCase().replace(/\s/g, '')}@example.com`, // Auto-generate email
                    password: 'password' // Default password
                };
                addTenantToRoom(roomId, newTenant);
                alert("Tenant added successfully!");
            }

            onClose();
            refreshData();
        } catch (error) {
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10"
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">
                            {initialData ? 'Edit Details' : 'New Tenant'}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium mt-1">
                            {initialData ? 'Update tenant information' : 'Add a new resident to the property'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
                    >
                        <X size={20} className="stroke-[3]" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                    placeholder="+91 99999..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Room No</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.room}
                                    onChange={e => setFormData({ ...formData, room: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                    placeholder="101"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Monthly Rent</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input
                                        type="number"
                                        required
                                        value={formData.rent}
                                        onChange={e => setFormData({ ...formData, rent: e.target.value })}
                                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                        placeholder="8000"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all appearance-none"
                                >
                                    <option value="Paid">Paid</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Join Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.joinDate}
                                    onChange={e => setFormData({ ...formData, joinDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                            <Save size={18} strokeWidth={2.5} />
                            {submitting ? 'Saving...' : 'Save Details'}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
