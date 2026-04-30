import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Bed, CreditCard, UserPlus, ArrowRightLeft, Trash2, Phone, Calendar } from 'lucide-react';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency } from '../../utils/format';

const RoomDetailsView = ({ room, onBack, onAddTenant, onShiftTenant, onRemoveTenant }) => {
    const { preferences } = useAppPreferences();
    const vacantBeds = room.capacity - room.occupied;
    const totalRent = room?.tenants?.reduce((sum, t) => sum + (t?.rent || 0), 0) || 0;

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, staggerChildren: 0.1 }
        },
        exit: { opacity: 0, x: -20 }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const getAvailabilityBadge = () => {
        if (vacantBeds > 1) {
            return { color: 'bg-green-100 text-green-700', text: `${vacantBeds} Beds Available` };
        } else if (vacantBeds === 1) {
            return { color: 'bg-yellow-100 text-yellow-700', text: '1 Bed Available' };
        } else {
            return { color: 'bg-red-100 text-red-700', text: 'Full Capacity' };
        }
    };

    const badge = getAvailabilityBadge();

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
            className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8"
        >
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Navigation */}
                <motion.button
                    whileHover={{ x: -4 }}
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
                >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                        <ArrowLeft size={16} />
                    </div>
                    Back to Overview
                </motion.button>

                {/* Header Section */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-white border-2 border-slate-100 shadow-xl flex flex-col items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unit</span>
                                <span className="text-3xl font-black text-slate-900 leading-none">{room.number}</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Details</h1>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${badge.color === 'bg-green-100 text-green-700' ? 'bg-green-50 text-green-700 border-green-100' : badge.color === 'bg-yellow-100 text-yellow-700' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                        {badge.text}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                                    <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                        Floor {room.floor || 'N/A'}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Users size={14} /> Capacity: {room.capacity}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onAddTenant}
                            disabled={room.occupied >= room.capacity}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <UserPlus size={18} />
                            Register Tenant
                        </motion.button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Beds', val: room.capacity, icon: Bed, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Occupied', val: room.occupied, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Vacant', val: vacantBeds, icon: Bed, color: 'text-green-600', bg: 'bg-green-50' },
                        { label: 'Revenue', val: formatCurrency(totalRent, preferences), icon: CreditCard, color: 'text-violet-600', bg: 'bg-violet-50' }
                    ].map((stat) => (
                        <motion.div
                            key={stat.label}
                            whileHover={{ y: -4 }}
                            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={20} />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-black text-slate-900">{stat.val}</h3>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Residents Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-slate-900">Current Residents</h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-xs font-bold text-slate-600 border border-slate-300">
                                {room.tenants?.length || 0}
                            </span>
                        </div>
                    </div>

                    <div className="p-6">
                        {!room.tenants || room.tenants.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100">
                                    <Users size={24} className="text-slate-300" />
                                </div>
                                <p className="text-slate-900 font-medium">No residents found</p>
                                <p className="text-slate-500 text-sm">Add a tenant to get started</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {room.tenants.map((tenant) => (
                                    <div key={tenant.id} className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
                                        <div className="flex items-start gap-4 mb-6">
                                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md ring-4 ring-slate-50">
                                                {tenant.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{tenant.name}</h3>
                                                <p className="text-xs font-medium text-slate-400 mt-1">ID: {tenant.id.slice(-6).toUpperCase()}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500 font-medium flex items-center gap-2"><Phone size={14} /> Phone</span>
                                                <span className="text-slate-900 font-semibold">{tenant.phone}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500 font-medium flex items-center gap-2"><CreditCard size={14} /> Rent</span>
                                                <span className="text-slate-900 font-bold">{formatCurrency(tenant.rent, preferences)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500 font-medium flex items-center gap-2"><Calendar size={14} /> Joined</span>
                                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold">{tenant.joinDate}</span>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => onShiftTenant(tenant)}
                                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-blue-600 bg-white border border-blue-100 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <ArrowRightLeft size={14} /> Shift
                                            </button>
                                            <button
                                                onClick={() => onRemoveTenant(tenant.id)}
                                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} /> Vacate
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default RoomDetailsView;
