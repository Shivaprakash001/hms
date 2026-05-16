import React, { useState } from 'react';
import { Search, Plus, Home, CheckCircle2, AlertCircle, History, Upload, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
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
        </div >
    );
}


