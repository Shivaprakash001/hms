import React, { useState, useEffect } from 'react';
import { Search, Plus, Home, CheckCircle2, AlertCircle, History, Upload, RefreshCw, User, GraduationCap, AlertTriangle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import api from '../../api/axios';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatDate as globalFormatDate, formatCurrency as globalFormatCurrency } from '../../utils/format';
import { useHostelContext } from '../../context/HostelContext';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import TenantInvitationForm from '../../components/owner/TenantInvitationForm';
import ExtendedProfileForm from '../../components/TenantManagement/ExtendedProfileForm';
import { StatCard } from '../../components/ui/StatCard';
import { TenantFormModal } from '../../features/tenants/components/TenantFormModal';
import { TenantList } from '../../features/tenants/components/TenantList';
import { StatusBadge } from '../../features/tenants/components/StatusBadge';
import { PaymentBadge } from '../../features/tenants/components/PaymentBadge';
import { useTenantActions } from '../../features/tenants/hooks/useTenantActions';
import { useTenants } from '../../features/tenants/hooks/useTenants';
import { getInitials } from '../../features/tenants/utils/tenantHelpers';

export default function ManageTenants() {
    const { preferences } = useAppPreferences();
    const { hostelId } = useHostelContext();
    const navigate = useNavigate();
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showIncrementModal, setShowIncrementModal] = useState(false);
    const [tenantToEdit, setTenantToEdit] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);

    const {
        filteredTenants,
        stats,
        yearDistribution,
        searchTerm,
        setSearchTerm,
        showLeftTenants,
        setShowLeftTenants,
        extendedProfileTenant,
        setExtendedProfileTenant,
        loading,
        error,
        fetchTenants
    } = useTenants({ hostelId });

    const {
        handleSaveTenant: saveTenant,
        handleDeleteTenant,
        handleToggleStatus: toggleStatus,
        handleResendInvitation: resendInvitation,
        handleCancelInvitation: cancelInvitation,
        handleCallTenant: callTenant
    } = useTenantActions({ fetchTenants });

    const handleCallTenant = async (phone, e) => {
        e?.stopPropagation?.();
        await callTenant(phone);
    };

    const handleSaveTenant = async (data) => {
        const { success } = await saveTenant(data, tenantToEdit);
        if (success) {
            setShowAddModal(false);
            setTenantToEdit(null);
        }
    };

    const handleToggleStatus = async (tenant, e) => {
        e?.stopPropagation?.();
        await toggleStatus(tenant);
    };

    const handleResendInvitation = async (tenant, e) => {
        e?.stopPropagation?.();
        await resendInvitation(tenant);
    };

    const handleCancelInvitation = async (tenant, e) => {
        e?.stopPropagation?.();
        await cancelInvitation(tenant);
    };

    const handleEditInvitation = (tenant, e) => {
        e.stopPropagation();
        setTenantToEdit(tenant);
        setShowAddModal(true);
    };

    const YEAR_COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#e0e7ff', '#94a3b8'];

    const formatCurrency = (value) => globalFormatCurrency(value, preferences);
    const formatDate = (dateString) => globalFormatDate(dateString, preferences);

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
                            onClick={() => setShowIncrementModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <GraduationCap size={18} />
                            Increment Year
                        </button>
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="bg-ops-accent hover:bg-ops-accent/700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95"
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
                            color="indigo"
                            iconPosition="right"
                        />
                        <StatCard
                            title="Occupied Rooms"
                            value={stats.occupiedRooms}
                            icon={Home}
                            color="blue"
                            iconPosition="right"
                        />
                        <StatCard
                            title="Active Tenants"
                            value={stats.active}
                            icon={CheckCircle2}
                            color="emerald"
                            iconPosition="right"
                            isCurrency={false}
                        />
                        <StatCard
                            title="Left / Inactive"
                            value={stats.left}
                            icon={AlertCircle}
                            color="rose"
                            iconPosition="right"
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
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-ops-accent transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name, room, roll no, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-ops-accent/50 focus:border-ops-accent/200 outline-none transition-all text-slate-700 font-medium shadow-sm placeholder:text-slate-400"
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
                <TenantList 
                    tenants={filteredTenants}
                    loading={loading}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onRowClick={(tenant) => navigate(`/dashboard/${hostelId}/tenants/${tenant.id}`)}
                    onEditInvitation={handleEditInvitation}
                    onResendInvitation={handleResendInvitation}
                    onCancelInvitation={handleCancelInvitation}
                    onToggleStatus={handleToggleStatus}
                    onCallTenant={handleCallTenant}
                />
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
                    <TenantFormModal
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

            <AnimatePresence>
                {showIncrementModal && (
                    <IncrementYearModal
                        isOpen={showIncrementModal}
                        onClose={() => setShowIncrementModal(false)}
                        hostelId={hostelId}
                        onConfirmSuccess={() => fetchTenants()}
                    />
                )}
            </AnimatePresence>
        </div >
    );
}

function IncrementYearModal({ isOpen, onClose, hostelId, onConfirmSuccess }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const fetchPreview = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.get(`/tenants/increment-year?hostelId=${hostelId}`);
                setPreview(res.data?.data || res.data);
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.error?.message || 'Failed to load preview details.');
            } finally {
                setLoading(false);
            }
        };
        fetchPreview();
    }, [isOpen, hostelId]);

    if (!isOpen) return null;

    const toIncrement = preview?.toIncrement || [];
    const violators = preview?.violators || [];
    const others = preview?.others || [];
    const canIncrement = toIncrement.length > 0;

    const handleConfirm = async () => {
        setSubmitting(true);
        setError('');
        try {
            const res = await api.post('/tenants/increment-year', { hostelId });
            alert(res.data?.message || res.data?.data?.message || 'Academic year successfully incremented!');
            onConfirmSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error?.message || 'Failed to execute increment action.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] text-left"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <GraduationCap size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Increment Academic Year</h3>
                            <p className="text-xs text-slate-500 font-medium">Batch progression tool for student tenants</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold px-2 py-1">✕</button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-indigo-600" size={32} />
                            <p className="text-sm font-semibold text-slate-600">Calculating eligible student progression...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-medium">
                            {error}
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-amber-50/80 border border-amber-100/70 rounded-2xl text-amber-800 text-xs font-semibold leading-relaxed flex gap-3 items-start">
                                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="font-bold text-amber-900 mb-1">Warning: Permanent Action</p>
                                    This action will increment the academic year of study of all active students in Sri Adithya Boys Hostel by +1. This progression must strictly adhere to the academic range (1st Year to 4th Year).
                                </div>
                            </div>

                            {/* Eligible */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                                    <CheckCircle2 className="text-emerald-500" size={14} /> Eligible for Increment ({toIncrement.length})
                                </h4>
                                {toIncrement.length === 0 ? (
                                    <p className="text-xs font-semibold text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100">No active students are currently eligible for progression.</p>
                                ) : (
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-[160px] overflow-y-auto space-y-2">
                                        {toIncrement.map((student) => (
                                            <div key={student.id} className="flex justify-between items-center text-xs font-bold text-slate-700 border-b border-slate-100/50 pb-1.5 last:border-b-0 last:pb-0">
                                                <span>{student.name} <span className="text-slate-400 font-medium">({student.roomNo})</span></span>
                                                <span className="text-indigo-600 font-black">{student.currentYear} Year → {student.nextYear} Year</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Violators (Already 4th Year) */}
                            {violators.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <AlertTriangle className="text-rose-500" size={14} /> Strictly Out of Range ({violators.length})
                                    </h4>
                                    <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl text-rose-900 text-xs font-semibold leading-relaxed mb-2">
                                        The following students are already in their <strong>4th Year</strong>. Incrementing them would violate the strict range (1 to 4) limit. They will be skipped and remain at 4th Year.
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-[160px] overflow-y-auto space-y-2">
                                        {violators.map((student) => (
                                            <div key={student.id} className="flex justify-between items-center text-xs font-bold text-rose-700 border-b border-slate-100/50 pb-1.5 last:border-b-0 last:pb-0">
                                                <span>{student.name} <span className="text-rose-400 font-medium">({student.roomNo})</span></span>
                                                <span className="text-rose-600 font-black">4th Year (Skipped)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Others */}
                            {others.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <HelpCircle className="text-slate-400" size={14} /> Year of Study Unspecified ({others.length})
                                    </h4>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-[120px] overflow-y-auto space-y-2 text-xs text-slate-500 font-semibold">
                                        These active student records have no academic year of study configured and will be skipped.
                                        <div className="mt-2 space-y-1">
                                            {others.map((student) => (
                                                <div key={student.id} className="text-slate-600 font-bold">
                                                    • {student.name} <span className="text-slate-400 font-medium">({student.roomNo})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-sm transition-all"
                    >
                        Cancel
                    </button>
                    {!loading && !error && (
                        <button
                            onClick={handleConfirm}
                            disabled={!canIncrement || submitting}
                            className={`px-5 py-2.5 text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                                !canIncrement 
                                ? 'bg-slate-300 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95'
                            }`}
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw className="animate-spin" size={16} />
                                    Progressing...
                                </>
                            ) : (
                                'Confirm & Progress Batch'
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}



