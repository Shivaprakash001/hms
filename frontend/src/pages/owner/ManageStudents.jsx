import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Phone, Home, CreditCard, Calendar, CheckCircle2, AlertCircle, X, Save, History, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { studentService, authService, allocationService, roomService } from '../../api/services';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import TenantInvitationForm from '../../components/owner/TenantInvitationForm';
import ExtendedProfileForm from '../../components/TenantManagement/ExtendedProfileForm';

export default function ManageStudents() {
    const location = useLocation();
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);
    const [error, setError] = useState(null);
    const [showLeftTenants, setShowLeftTenants] = useState(false);
    const [extendedProfileStudent, setExtendedProfileStudent] = useState(null);

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
                rollNumber: s.roll_number || 'N/A',
                yearOfStudy: s.year_of_study || null,
                room: s.current_room ? s.current_room.room_no : 'N/A',
                roomId: s.current_room?.id,
                floor: s.current_room && s.current_room.room_no ? s.current_room.room_no.substring(0, s.current_room.room_no.length - 2) : 'N/A',
                status: s.status,
                rent: s.monthly_rent,
                joinDate: s.joined_on,
                paymentSummary: s.payment_summary || {}
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

    useEffect(() => {
        const selectedTenantId = location.state?.selectedTenantId;
        if (!selectedTenantId || students.length === 0) return;

        const matchedStudent = students.find(student => student.id === selectedTenantId);
        if (matchedStudent) {
            setExtendedProfileStudent(matchedStudent);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.pathname, location.state, navigate, students]);

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
        if (!window.confirm("Are you sure you want to mark this tenant as LEFT? \n\nTheir payment history will be preserved, but their room allocation will be ended immediately, making the room available for new tenants.")) return;
        try {
            await studentService.delete(id);
            fetchStudents();
        } catch (err) {
            alert("Error removing student: " + err.message);
        }
    }

    const handleToggleStatus = async (student, e) => {
        e.stopPropagation();
        const isActive = student.status === 'ACTIVE';
        const nextStatus = isActive ? 'LEFT' : 'ACTIVE';
        const confirmMsg = isActive
            ? `Mark "${student.name}" as LEFT?\n\nThis will end their room allocation immediately.`
            : `Reactivate "${student.name}" as ACTIVE?\n\nThis will allow them to be assigned to a room again.`;
        if (!window.confirm(confirmMsg)) return;
        try {
            if (!isActive) {
                // LEFT → ACTIVE: use the reactivate endpoint
                await studentService.reactivate(student.id, {
                    monthly_rent: parseFloat(student.rent),
                    joined_on: new Date().toISOString().split('T')[0]
                });
            } else {
                // ACTIVE → LEFT: use the update endpoint
                await studentService.update(student.id, { status: 'LEFT' });
            }
            fetchStudents();
        } catch (err) {
            alert('Error toggling status: ' + (err.response?.data?.detail?.message || err.message));
        }
    };

    const handleResendInvitation = async (student, e) => {
        e.stopPropagation();
        if (!window.confirm(`Resend invitation to ${student.email}?`)) return;
        try {
            await studentService.resendInvitation(student.email);
            alert("Invitation resent successfully");
        } catch (err) {
            alert("Error resending invitation: " + (err.response?.data?.detail?.message || err.message));
        }
    };

    // Filter Logic
    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.phone && student.phone.includes(searchTerm)) ||
            (student.rollNumber && student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()));

        if (showLeftTenants) return matchesSearch;
        return matchesSearch && student.status !== 'LEFT';
    });

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

    // Year Distribution Calculation
    const yearDistribution = React.useMemo(() => {
        const counts = {
            '1st Year': 0,
            '2nd Year': 0,
            '3rd Year': 0,
            '4th Year': 0,
            'Other': 0
        };
        students.forEach(s => {
            const year = Number(s.yearOfStudy);
            if (year === 1) counts['1st Year']++;
            else if (year === 2) counts['2nd Year']++;
            else if (year === 3) counts['3rd Year']++;
            else if (year === 4) counts['4th Year']++;
            else counts['Other']++;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.value > 0);
    }, [students]);

    const YEAR_COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#e0e7ff', '#94a3b8'];

    const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

    const getPaymentBadgeStyles = (status) => {
        const styles = {
            PAID: 'bg-green-50 text-green-700 border-green-100',
            PARTIAL: 'bg-yellow-50 text-yellow-700 border-yellow-100',
            PENDING: 'bg-red-50 text-red-700 border-red-100',
            WAIVED: 'bg-slate-100 text-slate-700 border-slate-200',
            NOT_GENERATED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
            INACTIVE: 'bg-slate-50 text-slate-500 border-slate-100'
        };
        return styles[status] || styles.PENDING;
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

                {/* Stats & Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Stats Grid - 2/3 width on large screens */}
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4 sm:gap-6">
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
                            iconBg="bg-blue-50"
                            iconColor="text-blue-600"
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
                            iconBg="bg-rose-50"
                            iconColor="text-rose-600"
                            isCurrency={false}
                        />
                    </div>

                    {/* Year Perspective - 1/3 width */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Academic Mix</h3>
                        <div className="h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={yearDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={50}
                                        outerRadius={75}
                                        paddingAngle={5}
                                        stroke="none"
                                    >
                                        {yearDistribution.map((entry, index) => (
                                            <Cell key={entry.name} fill={YEAR_COLORS[index % YEAR_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
                            {yearDistribution.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{entry.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Search & Toggle */}
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 group w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name, room, roll no, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all text-slate-700 font-medium shadow-sm placeholder:text-slate-400"
                        />
                    </div>
                    <button
                        onClick={() => setShowLeftTenants(!showLeftTenants)}
                        className={`px-6 py-4 rounded-2xl font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${showLeftTenants
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <History size={18} />
                        {showLeftTenants ? 'Hide Former Tenants' : 'Show Former Tenants'}
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="overflow-x-auto">
                        <table className="w-full hidden md:table">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {['NAME', 'ROOM', 'ROLL NO', 'YEAR', 'RENT', 'LAST PAID', 'PENDING', 'PAYMENT STATUS'].map((header) => (
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
                                        <td colSpan="9" className="px-8 py-12 text-center text-slate-400 font-medium animate-pulse">
                                            Loading tenants...
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="px-8 py-16 text-center text-slate-400">
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
                                            onClick={() => {
                                                if (student.status !== 'INVITED') {
                                                    setExtendedProfileStudent(student);
                                                }
                                            }}
                                            className={`hover:bg-slate-50/80 transition-colors group ${student.status === 'INVITED' ? 'cursor-default' : 'cursor-pointer'}`}
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
                                            <td className="px-8 py-5 text-slate-600 font-semibold text-sm">{student.rollNumber || '-'}</td>
                                            <td className="px-8 py-5 text-slate-600 font-semibold text-sm">{student.yearOfStudy ? `${student.yearOfStudy} Year` : '-'}</td>
                                            <td className="px-8 py-5 text-slate-900 font-black text-sm">{formatCurrency(student.rent)}</td>
                                            <td className="px-8 py-5 text-slate-500 text-sm font-medium">
                                                <span>{formatDate(student.paymentSummary?.last_paid_at)}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${Number(student.paymentSummary?.pending_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {formatCurrency(student.paymentSummary?.pending_amount || 0)}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {student.paymentSummary?.current_month_amount ? `of ${formatCurrency(student.paymentSummary.current_month_amount)}` : 'No dues'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${getPaymentBadgeStyles(student.paymentSummary?.payment_status)}`}>
                                                    {student.paymentSummary?.payment_status === 'NOT_GENERATED' ? 'NOT GENERATED' : (student.paymentSummary?.payment_status || 'PENDING')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {student.status === 'INVITED' && (
                                                        <button
                                                            onClick={(e) => handleResendInvitation(student, e)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-indigo-600 hover:bg-indigo-50 border border-indigo-200 bg-indigo-50/50"
                                                            title="Resend Invitation"
                                                        >
                                                            <RefreshCw size={14} className="animate-spin-hover" /> Resend
                                                        </button>
                                                    )}
                                                    {(student.status === 'ACTIVE' || student.status === 'LEFT') && (
                                                        <button
                                                            onClick={(e) => handleToggleStatus(student, e)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${student.status === 'ACTIVE'
                                                                ? 'text-amber-600 hover:bg-amber-50 border border-amber-200 bg-amber-50/50'
                                                                : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200 bg-emerald-50/50'
                                                                }`}
                                                            title={student.status === 'ACTIVE' ? 'Mark as Left' : 'Reactivate'}
                                                        >
                                                            {student.status === 'ACTIVE'
                                                                ? <><ToggleLeft size={15} /> Mark Left</>
                                                                : <><ToggleRight size={15} /> Activate</>}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        <div className="md:hidden space-y-4 p-4">
                            {filteredStudents.map(student => (
                                <div 
                                    key={student.id} 
                                    onClick={() => {
                                        if (student.status !== 'INVITED') {
                                            setExtendedProfileStudent(student);
                                        }
                                    }}
                                    className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all active:scale-[0.98] ${student.status === 'INVITED' ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/80'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="font-black text-slate-900">{student.name}</div>
                                        <div className="px-2.5 py-1 bg-slate-50 rounded-lg text-[11px] font-black text-slate-500 border border-slate-100 uppercase tracking-wider">
                                            Room {student.room}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roll Number</p>
                                            <p className="font-bold text-slate-700">{student.rollNumber || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year</p>
                                            <p className="font-bold text-slate-700">{student.yearOfStudy ? `${student.yearOfStudy} Year` : '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Rent</p>
                                            <p className="font-bold text-slate-900">{formatCurrency(student.rent)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dues Pending</p>
                                            <p className={`font-bold ${Number(student.paymentSummary?.pending_amount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(student.paymentSummary?.pending_amount || 0)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${getPaymentBadgeStyles(student.paymentSummary?.payment_status)}`}>
                                            {student.paymentSummary?.payment_status || 'PENDING'}
                                        </span>
                                        
                                        <div className="flex items-center gap-2">
                                            {student.status === 'INVITED' && (
                                                <button
                                                    onClick={(e) => handleResendInvitation(student, e)}
                                                    className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 bg-indigo-50 text-indigo-600 border border-indigo-100"
                                                >
                                                    Resend
                                                </button>
                                            )}
                                            {(student.status === 'ACTIVE' || student.status === 'LEFT') && (
                                                <button
                                                    onClick={(e) => handleToggleStatus(student, e)}
                                                    className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                                        student.status === 'ACTIVE'
                                                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    }`}
                                                >
                                                    {student.status === 'ACTIVE' ? 'Mark Left' : 'Activate'}
                                                </button>
                                            )}
                                        </div>
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

            {/* Extended Profile Modal */}
            <ExtendedProfileForm
                isOpen={!!extendedProfileStudent}
                onClose={() => setExtendedProfileStudent(null)}
                student={extendedProfileStudent}
                onSave={() => { fetchStudents(); setExtendedProfileStudent(null); }}
            />

            {/* Tenant History Modal */}
            <TenantHistoryModal
                isOpen={!!historyTenant}
                onClose={() => setHistoryTenant(null)}
                tenantId={historyTenant?.tenantId}
                tenantName={historyTenant?.tenantName}
            />
        </div >
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
            // grouped=true returns floors with nested rooms that include occupancy counts
            const floors = await roomService.getAll();  // default grouped=true

            // Flatten rooms from all floors
            let allRooms = [];
            if (Array.isArray(floors)) {
                for (const floor of floors) {
                    if (Array.isArray(floor.rooms)) {
                        allRooms = allRooms.concat(floor.rooms);
                    }
                }
            }

            // Only show rooms that still have capacity (not fully occupied)
            const available = allRooms.filter(r => (r.occupied ?? 0) < (r.capacity ?? Infinity));
            setRooms(available);
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
                                    <option value="">Select a room</option>
                                    {loadingRooms
                                        ? <option disabled>Loading rooms...</option>
                                        : rooms.map(r => (
                                            <option key={r.id} value={r.id}>
                                                Room {r.number ?? r.room_no} — {r.occupied ?? 0}/{r.capacity} occupied
                                            </option>
                                        ))
                                    }
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

                        {initialData && (initialData.status === 'ACTIVE' || initialData.status === 'LEFT') && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="LEFT">LEFT</option>
                                </select>
                            </div>
                        )}
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
