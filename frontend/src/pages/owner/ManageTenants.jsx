import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, User, Phone, Home, CreditCard, Calendar, CheckCircle2, AlertCircle, X, Save, History, Trash2, RefreshCw, ToggleLeft, ToggleRight, XCircle, Clock, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatDate as globalFormatDate, formatCurrency as globalFormatCurrency } from '../../utils/format';
import { tenantService, roomService } from '../../api/services';
import { useTenants } from '../../hooks/useTenants';
import { useRooms } from '../../hooks/useRooms';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import TenantInvitationForm from '../../components/owner/TenantInvitationForm';
import ExtendedProfileForm from '../../components/TenantManagement/ExtendedProfileForm';
import { useHostelContext } from '../../context/HostelContext';

export default function ManageTenants() {
    const { preferences } = useAppPreferences();
    const { hostelId } = useHostelContext();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [tenantToEdit, setTenantToEdit] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);
    const [showLeftTenants, setShowLeftTenants] = useState(false);
    const [extendedProfileTenant, setExtendedProfileTenant] = useState(null);

    const { data: tenantsResponse, isLoading: loading, error, refetch: fetchTenants } = useTenants(hostelId);

    const tenants = useMemo(() => {
        if (!tenantsResponse) return [];
        const tenantsList = Array.isArray(tenantsResponse) ? tenantsResponse : (tenantsResponse.tenants || []);
        
        return tenantsList.map(s => ({
            id: s.id,
            profileId: s.profile_id,
            name: s.profile?.name || 'Unknown',
            email: s.profile?.email,
            phone: s.profile?.phone || 'N/A',
            rollNumber: s.roll_number || 'N/A',
            yearOfStudy: s.year_of_study || null,
            room: (s.allocations && s.allocations.length > 0 && s.allocations[0].room) ? s.allocations[0].room.room_no : 'N/A',
            roomId: (s.allocations && s.allocations.length > 0) ? s.allocations[0].room_id : null,
            floor: (s.allocations && s.allocations.length > 0 && s.allocations[0].room) ? (s.allocations[0].room.floor ?? 'N/A') : 'N/A',
            status: s.status,
            rent: s.monthly_rent,
            joinDate: s.joined_on,
            paymentSummary: s.payment_summary || {}
        }));
    }, [tenantsResponse]);

    const handleCallTenant = async (phone, e) => {
        e?.stopPropagation?.();
        if (!phone || phone === 'N/A') {
            alert('Phone number unavailable');
            return;
        }

        try {
            await navigator.clipboard.writeText(phone);
        } catch (err) {
            console.error('Clipboard copy failed:', err);
        }

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            window.open(`tel:${phone}`, '_self');
        } else {
            alert('Phone number copied to clipboard');
        }
    };



    useEffect(() => {
        const selectedTenantId = location.state?.selectedTenantId;
        if (!selectedTenantId || tenants.length === 0) return;

        const matchedTenant = tenants.find(tenant => tenant.id === selectedTenantId);
        if (matchedTenant) {
            setExtendedProfileTenant(matchedTenant);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.pathname, location.state, navigate, tenants]);

    // Handlers
    const handleSaveTenant = async (data) => {
        try {
            if (tenantToEdit) {
                if (tenantToEdit.status !== 'INVITED') {
                    alert('Tenant details are locked after activation.');
                    return;
                }
                const result = await tenantService.update(tenantToEdit.id, {
                    invitation_edit: true,
                    name: data.name,
                    email: data.email,
                    phone: data.phone || '',
                    room_id: data.roomId,
                    monthly_rent: parseFloat(data.rent),
                    joining_date: data.joinDate,
                });
                alert(result?.message || "Invitation updated and resent successfully");
            }
            fetchTenants();
            setShowAddModal(false);
            setTenantToEdit(null);
        } catch (err) {
            alert("Error saving tenant: " + (err.response?.data?.error?.message || err.response?.data?.detail || err.message));
        }
    };

    const handleDeleteTenant = async (id) => {
        if (!window.confirm("Are you sure you want to mark this tenant as LEFT? \n\nTheir payment history will be preserved, but their room allocation will be ended immediately, making the room available for new tenants.")) return;
        try {
            await tenantService.delete(id);
            fetchTenants();
        } catch (err) {
            alert("Error removing tenant: " + err.message);
        }
    }

    const handleToggleStatus = async (tenant, e) => {
        e.stopPropagation();
        const isActive = tenant.status === 'ACTIVE';
        if (isActive) {
            alert("Directly marking a tenant as LEFT is not allowed. Please use the Move-Outs tab to process their departure and ensure all security deposits and rent settlements are handled securely.");
            return;
        }
        
        const confirmMsg = `Reactivate "${tenant.name}" as ACTIVE?\n\nThis will allow them to be assigned to a room again.`;
        if (!window.confirm(confirmMsg)) return;
        try {
            if (!isActive) {
                // LEFT → ACTIVE: use the reactivate endpoint
                await tenantService.reactivate(tenant.id, {
                    monthly_rent: parseFloat(tenant.rent),
                    joined_on: new Date().toISOString().split('T')[0]
                });
            } else {
                // ACTIVE → LEFT is blocked above, but keep else branch for safety
                alert("Please use the Move-Out workflow.");
            }
            fetchTenants();
        } catch (err) {
            alert('Error toggling status: ' + (err.response?.data?.detail?.message || err.message));
        }
    };

    const handleResendInvitation = async (tenant, e) => {
        e.stopPropagation();
        if (!window.confirm(`Resend invitation to ${tenant.email}?`)) return;
        try {
            const res = await tenantService.resendInvitation(tenant.email);
            alert(res?.message || "Invitation resent successfully");
        } catch (err) {
            alert("Error resending invitation: " + (err.response?.data?.error?.message || err.message));
        }
    };

    const handleCancelInvitation = async (tenant, e) => {
        e.stopPropagation();
        if (!window.confirm(`Cancel invitation for "${tenant.name}"?\n\nThis will:\n• Free their room allocation immediately\n• Waive any pending obligations\n• Mark them as CANCELLED (not recoverable via this action)`)) return;
        try {
            await tenantService.cancelInvitation(tenant.id);
            fetchTenants();
        } catch (err) {
            alert('Error cancelling invitation: ' + (err.response?.data?.error?.message || err.message));
        }
    };

    const handleEditInvitation = (tenant, e) => {
        e.stopPropagation();
        setTenantToEdit(tenant);
        setShowAddModal(true);
    };

    // Filter Logic
    const filteredTenants = useMemo(() => {
        const INACTIVE_STATUSES = ['LEFT', 'CANCELLED', 'EXPIRED'];
        return tenants.filter(tenant => {
            const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tenant.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tenant.phone && tenant.phone.includes(searchTerm)) ||
                (tenant.rollNumber && tenant.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            if (showLeftTenants) return matchesSearch;
            return matchesSearch && !INACTIVE_STATUSES.includes(tenant.status);
        });
    }, [tenants, searchTerm, showLeftTenants]);

    // Stats Calculation
    const stats = useMemo(() => ({
        total: tenants.length,
        occupiedRooms: new Set(tenants.filter(s => s.room !== 'N/A').map(s => s.room)).size,
        paid: tenants.filter(s => s.paymentSummary?.payment_status === 'PAID').length,
        active: tenants.filter(s => s.status === 'ACTIVE').length,
        left: tenants.filter(s => ['LEFT', 'CANCELLED', 'EXPIRED'].includes(s.status)).length
    }), [tenants]);

    const formatDate = (dateString) => globalFormatDate(dateString, preferences);

    // Year Distribution Calculation
    const yearDistribution = React.useMemo(() => {
        const counts = {
            '1st Year': 0,
            '2nd Year': 0,
            '3rd Year': 0,
            '4th Year': 0,
            'Other': 0
        };
        tenants.forEach(s => {
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
    }, [tenants]);

    const YEAR_COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#e0e7ff', '#94a3b8'];

    const formatCurrency = (value) => globalFormatCurrency(value, preferences);

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

    const getStatusBadge = (status) => {
        const cfg = {
            ACTIVE:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Active' },
            INVITED:   { cls: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: 'Invited' },
            MOVE_OUT_REQUESTED: { cls: 'bg-orange-50 text-orange-700 border-orange-100', label: 'Move-Out Req' },
            LEFT:      { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Left' },
            EXPIRED:   { cls: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Expired' },
            CANCELLED: { cls: 'bg-rose-50 text-rose-600 border-rose-100', label: 'Cancelled' },
        };
        const { cls, label } = cfg[status] || cfg.LEFT;
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${cls}`}>{label}</span>;
    };

    const getInitials = (name) => {
        return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    };

    return (
        <div className="font-sans pb-20">
            <div className="space-y-8">
                {/* Error Banner */}
                {error && (
                    <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
                        <span className="flex-1">{error.message || 'Failed to load tenants'}</span>
                        <button onClick={fetchTenants} className="text-xs font-semibold underline hover:no-underline">
                            Retry
                        </button>
                    </div>
                )}
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tenant Management</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your property tenants and track payments</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchTenants}
                            className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={() => navigate(`/hostels/${hostelId}/bulk-import`)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                        >
                            <Upload size={18} />
                            Bulk Import
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
                                    {['NAME', 'ROOM', 'ROLL NO', 'YEAR', 'RENT', 'LAST PAID', 'PENDING', 'PAYMENT STATUS', 'STATUS'].map((header) => (
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
                                        <td colSpan="10" className="px-8 py-12 text-center text-slate-400 font-medium animate-pulse">
                                            Loading tenants...
                                        </td>
                                    </tr>
                                ) : filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="px-8 py-16 text-center text-slate-400">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <User size={24} className="text-slate-300" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-700 mb-1">No tenants found</h3>
                                            <p className="text-sm font-medium">Try adjusting your search or add a new tenant</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTenants.map((tenant) => (
                                        <motion.tr
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            key={tenant.id}
                                            onClick={() => navigate(`/dashboard/${hostelId}/tenants/${tenant.id}`)}
                                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        {getInitials(tenant.name)}
                                                    </div>
                                                    <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{tenant.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-slate-600 font-bold text-sm">{tenant.room}</td>
                                            <td className="px-8 py-5 text-slate-600 font-semibold text-sm">{tenant.rollNumber || '-'}</td>
                                            <td className="px-8 py-5 text-slate-600 font-semibold text-sm">{tenant.yearOfStudy ? `${tenant.yearOfStudy} Year` : '-'}</td>
                                            <td className="px-8 py-5 text-slate-900 font-black text-sm">{formatCurrency(tenant.rent)}</td>
                                            <td className="px-8 py-5 text-slate-500 text-sm font-medium">
                                                <span>{formatDate(tenant.paymentSummary?.last_paid_at)}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${Number(tenant.paymentSummary?.pending_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {formatCurrency(tenant.paymentSummary?.pending_amount || 0)}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {tenant.paymentSummary?.current_month_amount ? `of ${formatCurrency(tenant.paymentSummary.current_month_amount)}` : 'No dues'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${getPaymentBadgeStyles(tenant.paymentSummary?.payment_status)}`}>
                                                    {tenant.paymentSummary?.payment_status === 'NOT_GENERATED' ? 'NOT GENERATED' : (tenant.paymentSummary?.payment_status || 'PENDING')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                {getStatusBadge(tenant.status)}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {tenant.status === 'INVITED' && (<>
                                                        <button
                                                            onClick={(e) => handleEditInvitation(tenant, e)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-700 hover:bg-slate-50 border border-slate-200 bg-white"
                                                            title="Edit Invitation"
                                                        >
                                                            <Save size={14} /> Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleResendInvitation(tenant, e)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-indigo-600 hover:bg-indigo-50 border border-indigo-200 bg-indigo-50/50"
                                                            title="Resend Invitation"
                                                        >
                                                            <RefreshCw size={14} /> Resend
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleCancelInvitation(tenant, e)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-rose-600 hover:bg-rose-50 border border-rose-200 bg-rose-50/50"
                                                            title="Cancel Invitation"
                                                        >
                                                            <XCircle size={14} /> Cancel
                                                        </button>
                                                    </>)}
                                                    {(tenant.status === 'LEFT') && (
                                                        <button
                                                            onClick={(e) => handleToggleStatus(tenant, e)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tenant.status === 'ACTIVE'
                                                                ? 'text-amber-600 hover:bg-amber-50 border border-amber-200 bg-amber-50/50'
                                                                : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200 bg-emerald-50/50'
                                                                }`}
                                                            title={tenant.status === 'ACTIVE' ? 'Mark as Left' : 'Reactivate'}
                                                        >
                                                            {tenant.status === 'ACTIVE'
                                                                ? <><ToggleLeft size={15} /> Mark Left</>
                                                                : <><ToggleRight size={15} /> Activate</>}
                                                        </button>
                                                    )}
                                                    {(tenant.status === 'CANCELLED' || tenant.status === 'EXPIRED') && (
                                                        <span className="text-xs text-slate-400 font-medium italic">
                                                            {tenant.status === 'CANCELLED' ? 'Invite cancelled' : 'Invite expired'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        <div className="md:hidden space-y-4 p-4">
                            {filteredTenants.map(tenant => (
                                <div 
                                    key={tenant.id} 
                                    onClick={() => navigate(`/dashboard/${hostelId}/tenants/${tenant.id}`)}
                                    className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50/80 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="font-black text-slate-900">{tenant.name}</div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => handleCallTenant(tenant.phone, e)}
                                                disabled={!tenant.phone || tenant.phone === 'N/A'}
                                                title={tenant.phone && tenant.phone !== 'N/A' ? `Call ${tenant.name}` : 'Phone number unavailable'}
                                                className={`p-2 rounded-lg border transition-all ${
                                                    tenant.phone && tenant.phone !== 'N/A'
                                                        ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                                                        : 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                                                }`}
                                            >
                                                <Phone size={14} />
                                            </button>
                                            <div className="px-2.5 py-1 bg-slate-50 rounded-lg text-[11px] font-black text-slate-500 border border-slate-100 uppercase tracking-wider">
                                                Room {tenant.room}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roll Number</p>
                                            <p className="font-bold text-slate-700">{tenant.rollNumber || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year</p>
                                            <p className="font-bold text-slate-700">{tenant.yearOfStudy ? `${tenant.yearOfStudy} Year` : '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Rent</p>
                                            <p className="font-bold text-slate-900">{formatCurrency(tenant.rent)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dues Pending</p>
                                            <p className={`font-bold ${Number(tenant.paymentSummary?.pending_amount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(tenant.paymentSummary?.pending_amount || 0)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${getPaymentBadgeStyles(tenant.paymentSummary?.payment_status)}`}>
                                                {tenant.paymentSummary?.payment_status || 'PENDING'}
                                            </span>
                                            {getStatusBadge(tenant.status)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {tenant.status === 'INVITED' && (
                                                <>
                                                    <button
                                                        onClick={(e) => handleEditInvitation(tenant, e)}
                                                        className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 bg-slate-50 text-slate-600 border border-slate-100"
                                                    >
                                                        Edit Invite
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleCancelInvitation(tenant, e)}
                                                        className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 bg-rose-50 text-rose-600 border border-rose-100"
                                                    >
                                                        Cancel Invite
                                                    </button>
                                                </>
                                            )}
                                            {(tenant.status === 'LEFT') && (
                                                <button
                                                    onClick={(e) => handleToggleStatus(tenant, e)}
                                                    className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                                        tenant.status === 'ACTIVE'
                                                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    }`}
                                                >
                                                    {tenant.status === 'ACTIVE' ? 'Mark Left' : 'Activate'}
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
                onInviteSuccess={() => fetchTenants()}
            />

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <AddTenantModal
                        onClose={() => { setShowAddModal(false); setTenantToEdit(null); }}
                        initialData={tenantToEdit}
                        onSave={handleSaveTenant}
                    />
                )}
            </AnimatePresence>

            {/* Extended Profile Modal */}
            <ExtendedProfileForm
                isOpen={!!extendedProfileTenant}
                onClose={() => setExtendedProfileTenant(null)}
                tenant={extendedProfileTenant}
                onSave={() => { fetchTenants(); setExtendedProfileTenant(null); }}
            />

            {/* Tenant History Modal */}
            <TenantHistoryModal
                isOpen={!!historyTenant}
                onClose={() => setHistoryTenant(null)}
                tenantId={historyTenant?.tenantId}
                tenantName={historyTenant?.tenantName}
                hostelId={hostelId}
            />
        </div >
    );
}

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor, isCurrency = false }) => (
    <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
            <p className="text-slate-400 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider mb-1 sm:mb-2">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">{isCurrency ? '₹' : ''}{value}</h3>
        </div>
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
            <Icon size={18} className="sm:size-[22px]" strokeWidth={2.5} />
        </div>
    </div>
);

const AddTenantModal = ({ onClose, initialData, onSave }) => {
    const { hostelId } = useHostelContext();
    const { data: floorsData, isLoading: loadingRooms } = useRooms(hostelId, { grouped: true });
    const isInvitationEdit = initialData?.status === 'INVITED';
    
    const rooms = useMemo(() => {
        let allRooms = [];
        if (Array.isArray(floorsData)) {
            for (const floor of floorsData) {
                if (Array.isArray(floor.rooms)) {
                    allRooms = allRooms.concat(floor.rooms);
                }
            }
        }
        return allRooms.filter(r => (r.occupied ?? 0) < (r.capacity ?? Infinity));
    }, [floorsData]);

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        roomId: initialData?.roomId || '',
        rent: initialData?.rent || '',
        status: initialData?.status || 'ACTIVE',
        joinDate: initialData?.joinDate || new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);

    const handleRoomChange = (roomId) => {
        const selectedRoom = rooms.find((room) => String(room.id) === String(roomId));
        const baseRent = Number(selectedRoom?.base_rent ?? 0);
        setFormData({
            ...formData,
            roomId,
            ...(!initialData && baseRent > 0 ? { rent: String(baseRent) } : {}),
        });
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
                            {isInvitationEdit ? 'Edit Invitation' : initialData ? 'Details Locked' : 'New Tenant'}
                        </h2>
                        {isInvitationEdit && (
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Changes are allowed only before tenant activation.
                            </p>
                        )}
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

                        {(!initialData || isInvitationEdit) && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Room</label>
                                <select
                                    value={formData.roomId}
                                    onChange={e => handleRoomChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                    required
                                >
                                    <option value="">Select a room</option>
                                    {loadingRooms
                                        ? <option disabled>Loading rooms...</option>
                                        : rooms.map(r => (
                                            <option key={r.id} value={r.id}>
                                                Room {r.number ?? r.room_no} — {r.occupied ?? 0}/{r.capacity} occupied
                                                {Number(r.base_rent || 0) > 0 ? ` — ₹${Number(r.base_rent).toLocaleString('en-IN')}` : ''}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {isInvitationEdit && (
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                    />
                                </div>
                            )}
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
                        {initialData && ['INVITED', 'CANCELLED', 'EXPIRED'].includes(initialData.status) && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-500">
                                    {initialData.status} <span className="text-xs font-normal">(read-only)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                        <button type="submit" disabled={submitting || (initialData && !isInvitationEdit)} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50">
                            {submitting ? 'Saving...' : isInvitationEdit ? 'Save & Resend' : 'Save Details'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
