import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Phone, Home, CreditCard, Calendar, CheckCircle2, AlertCircle, X, Save, History, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { studentService, authService, allocationService, roomService } from '../../api/services';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import TenantInvitationForm from '../../components/owner/TenantInvitationForm';

export default function ManageStudents() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);
    const [error, setError] = useState(null);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const response = await studentService.getAll();
            const studentsList = Array.isArray(response) ? response : (response.students || []);

            const data = studentsList.map(s => ({
                id: s.id,
                profileId: s.profile_id,
                name: s.profile?.name || 'Unknown',
                email: s.profile?.email,
                phone: s.profile?.phone || 'N/A',
                room: s.current_room ? s.current_room.room_no : 'N/A',
                roomId: s.current_room?.id,
                floor: s.current_room && s.current_room.room_no ? s.current_room.room_no.substring(0, s.current_room.room_no.length - 2) : 'N/A',
                status: s.status,
                rent: s.monthly_rent,
                joinDate: s.joined_on
            }));

            setStudents(data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch students:", err);
            setError("Failed to load tenants. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    // Handlers
    const handleSaveStudent = async (data) => {
        try {
            if (studentToEdit) {
                await studentService.update(studentToEdit.id, {
                    monthly_rent: parseFloat(data.rent),
                    status: data.status,
                    joined_on: data.joinDate
                });
                alert("Student updated successfully");
            }
            fetchStudents();
            setShowAddModal(false);
        } catch (err) {
            alert("Error saving student: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleDeleteStudent = async (id) => {
        if (!window.confirm("Are you sure you want to remove this tenant? They will be marked as LEFT.")) return;
        try {
            await studentService.delete(id);
            fetchStudents();
        } catch (err) {
            alert("Error removing student: " + err.message);
        }
    }

    // Filter Logic
    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.phone && student.phone.includes(searchTerm))
    );

    // Stats Calculation
    const stats = {
        total: students.length,
        occupiedRooms: new Set(students.filter(s => s.room !== 'N/A').map(s => s.room)).size,
        paid: students.filter(s => s.status === 'Paid').length, // 'Paid' status might need to come from payment history? Or student status? Student status is ACTIVE/LEFT. 
        // Wait, existing UI uses 'Paid'/'Pending' as status. Backend uses ACTIVE/LEFT.
        // Payment status should be separate.
        // For now, let's map ACTIVE to 'Active' and handle Payment Status separately if we have it?
        // Or assume student.status is overridden logic in frontend?
        // Let's us ACTIVE for now.
        active: students.filter(s => s.status === 'ACTIVE').length,
        left: students.filter(s => s.status === 'LEFT').length
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
        <div className="font-sans pb-20">
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tenant Management</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your property tenants and track payments</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchStudents}
                            className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <Plus size={18} />
                            Invite Tenant
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
                        title="Active Tenants"
                        value={stats.active}
                        icon={CheckCircle2}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        isCurrency={false}
                    />
                    <StatCard
                        title="Left / Inactive"
                        value={stats.left}
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
                                    <th className="px-8 py-5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-8 py-12 text-center text-slate-400 font-medium animate-pulse">
                                            Loading tenants...
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-8 py-16 text-center text-slate-400">
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
                                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${student.status === 'ACTIVE'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : student.status === 'INVITED'
                                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                        : 'bg-slate-50 text-slate-600 border border-slate-100'
                                                    }`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-slate-900 font-black text-sm">₹{student.rent?.toLocaleString()}</td>
                                            <td className="px-8 py-5 text-slate-500 text-sm font-medium">
                                                <span>{formatDate(student.joinDate)}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteStudent(student.id);
                                                    }}
                                                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove Tenant"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Mobile Card View (Simplified) */}
                        <div className="md:hidden space-y-4 p-4">
                            {filteredStudents.map(student => (
                                <div key={student.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm" onClick={() => { setStudentToEdit(student); setShowAddModal(true); }}>
                                    <div className="flex justify-between">
                                        <div className="font-bold">{student.name}</div>
                                        <div className="text-sm font-bold text-slate-500">{student.room}</div>
                                    </div>
                                    <div className="flex justify-between mt-2 text-sm text-slate-500">
                                        <div>{student.status}</div>
                                        <div>₹{student.rent}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Invitation Modal */}
            <TenantInvitationForm
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                onInviteSuccess={() => fetchStudents()}
            />

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <AddStudentModal
                        onClose={() => setShowAddModal(false)}
                        initialData={studentToEdit}
                        onSave={handleSaveStudent}
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

const AddStudentModal = ({ onClose, initialData, onSave }) => {
    // We need list of vacant rooms to select from if adding new
    const [rooms, setRooms] = useState([]);
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        roomId: initialData?.roomId || '',
        rent: initialData?.rent || '',
        status: initialData?.status || 'ACTIVE',
        joinDate: initialData?.joinDate || new Date().toISOString().split('T')[0]
    });
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!initialData) {
            // Load vacant rooms
            loadRooms();
        }
    }, [initialData]);

    const loadRooms = async () => {
        setLoadingRooms(true);
        try {
            const data = await roomService.getAll();
            // Simple client-side filter for now. Ideally backend filter.
            // We need to know which rooms are not full.
            // But roomService.getAll returns raw rooms without occupancy info usually?
            // Wait, ManageRooms calculated occupancy.
            // Here we might just list all rooms and let backend error if full, or try to guess.
            // For better UX, we should fetch allocations too.
            // For now, listing all rooms.
            setRooms(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingRooms(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        if (!formData.email && !initialData) {
            // Generate email if not provided for new user
            formData.email = `${formData.name.toLowerCase().replace(/\s/g, '')}.${Math.floor(Math.random() * 1000)}@example.com`;
        }
        await onSave(formData);
        setSubmitting(false);
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
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Name</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                        </div>

                        {!initialData && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Room</label>
                                <select
                                    value={formData.roomId}
                                    onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                    required
                                >
                                    <option value="">Select Room</option>
                                    {rooms.map(r => (
                                        <option key={r.id} value={r.id}>Room {r.room_no} ({r.capacity})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Rent</label>
                                <input type="number" required value={formData.rent} onChange={e => setFormData({ ...formData, rent: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Join Date</label>
                                <input type="date" required value={formData.joinDate} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                        <button type="submit" disabled={submitting} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg">
                            {submitting ? 'Saving...' : 'Save Details'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
