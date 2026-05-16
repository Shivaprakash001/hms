import React from 'react';
import { motion } from 'framer-motion';
import { Users, Trash2, Loader2, X, Phone, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';
import { useAppPreferences } from '../../../context/AppPreferencesContext';

export const RoomDetailSidebar = ({ room, onClose, onEditRoom, onDeleteRoom, isDeletingRoom, onAddTenant, onRemoveTenant, onShiftTenant, onOpenTenant, onCallTenant }) => {
    const { preferences } = useAppPreferences();
    const roomInfo = room?.room || room;
    const occupants = room?.tenants || room?.occupants || roomInfo?.tenants || [];
    const capacity = roomInfo?.capacity || 0;
    const roomNo = roomInfo?.room_no || roomInfo?.number;
    const floor = roomInfo?.floor ?? 'N/A';

    const getPaymentTone = (status) => {
        switch (status) {
            case 'PAID':
                return 'bg-green-50 text-green-700 border-green-100';
            case 'PARTIAL':
                return 'bg-yellow-50 text-yellow-700 border-yellow-100';
            case 'PENDING':
                return 'bg-red-50 text-red-700 border-red-100';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900">Room {roomNo}</h2>
                            <p className="text-slate-400 font-bold mt-1">Floor {floor}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={onEditRoom} className="p-2 hover:bg-slate-100 rounded-xl font-bold text-slate-500 hover:text-indigo-600 transition-colors text-sm flex items-center gap-1">
                                Edit 
                            </button>
                            <button
                                onClick={onDeleteRoom}
                                disabled={isDeletingRoom || occupants.length > 0}
                                title={occupants.length > 0 ? 'Shift or remove residents before deleting' : 'Delete room'}
                                className={`p-2 rounded-xl font-bold text-sm flex items-center gap-1 transition-colors ${
                                    occupants.length > 0
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                }`}
                            >
                                {isDeletingRoom ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                Delete
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Capacity</p>
                                    <p className="text-2xl font-black text-slate-900 mt-2">{capacity}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Occupied</p>
                                    <p className="text-2xl font-black text-slate-900 mt-2">{occupants.length}</p>
                                </div>
                            </div>

                        {/* Occupants List */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Users size={20} />
                                    Residents ({occupants.length}/{capacity})
                                </h3>
                                {occupants.length < capacity && (
                                    <button
                                        onClick={onAddTenant}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        + Add Resident
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {occupants.map(tenant => (
                                    <div
                                        key={tenant.tenant_id || tenant.id}
                                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => onOpenTenant(tenant)}
                                                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 font-bold shadow-sm hover:text-indigo-600 transition-colors"
                                            >
                                                {(tenant.name || '?').charAt(0)}
                                            </button>
                                            <div>
                                                <button
                                                    onClick={() => onOpenTenant(tenant)}
                                                    className="font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                                                >
                                                    {tenant.name}
                                                </button>
                                                <div className="text-xs font-semibold text-slate-400">Joined: {tenant.joined_date || tenant.joinedOn || 'N/A'}</div>
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    {tenant.rent != null && (
                                                        <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-100">
                                                            {formatCurrency(Number(tenant.rent), preferences)}/month
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getPaymentTone((tenant.payment_status || '').toUpperCase())}`}>
                                                        {(tenant.payment_status || 'NO_HISTORY').replace('_', ' ')}
                                                    </span>
                                                    {tenant.pending_dues > 0 && (
                                                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                                                            Due {formatCurrency(Number(tenant.pending_dues), preferences)}
                                                        </span>
                                                    )}
                                                </div>
                                                {tenant.last_payment && (
                                                    <div className="text-xs text-slate-500 mt-2">
                                                        Last paid on {tenant.last_payment}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onCallTenant?.(tenant.phone)}
                                                disabled={!tenant.phone || tenant.phone === 'No phone'}
                                                className={`p-2 rounded-xl transition-all ${
                                                    tenant.phone && tenant.phone !== 'No phone'
                                                        ? 'text-green-600 hover:bg-green-50'
                                                        : 'text-slate-300 cursor-not-allowed'
                                                }`}
                                                title={tenant.phone && tenant.phone !== 'No phone' ? 'Call Tenant' : 'Phone number unavailable'}
                                            >
                                                <Phone size={18} />
                                            </button>
                                            <button
                                                onClick={() => onShiftTenant(tenant)}
                                                className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Relocate Tenant"
                                            >
                                                <ArrowRightLeft size={18} />
                                            </button>
                                            <button
                                                onClick={() => onRemoveTenant(tenant.tenant_id || tenant.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Remove Tenant"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {occupants.length === 0 && (
                                    <div className="py-8 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                                        Room is currently vacant
                                    </div>
                                )}
                            </div>
                        </div>
                        </>
                    </div>
                </div>
            </motion.div>
        </>
    );
};
